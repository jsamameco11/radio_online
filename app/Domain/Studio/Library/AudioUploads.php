<?php

namespace App\Domain\Studio\Library;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaFolder;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Enums\TrackKind;
use App\Models\User;
use Aws\S3\Exception\S3Exception;
use finfo;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Throwable;

/**
 * Brings audio into a station library.
 *
 * With Wasabi the file travels from the browser straight to the bucket in
 * parts (S3 multipart upload with presigned URLs): a two-hour program never
 * passes through the web server and a dropped connection only repeats one
 * part. The server opens the upload, signs its parts and, when the form is
 * saved, closes it and checks that the whole file arrived and is audio.
 * Without Wasabi (development, tests) the file comes with the form.
 */
final class AudioUploads
{
    /** S3 asks at least 5 MB for every part but the last one. */
    public const PART_BYTES = 8 * 1024 * 1024;

    private const MAX_PARTS = 10000;

    /** Hours the signed parts and the open upload stay valid. */
    private const HOURS = 12;

    /** Bytes read from the start of the file to tell that it is audio. */
    private const SNIFF_BYTES = 4096;

    private const EXPIRED = 'La subida del audio venció o no llegó completa. Vuelve a subirlo.';

    private const UNREACHABLE = 'No pudimos conectar con el almacenamiento de audios. Revisa tu conexión e inténtalo de nuevo.';

    public function __construct(
        private readonly MediaStorage $storage,
        private readonly CurrentStation $current,
    ) {}

    /** Whether audio can go from the browser straight to the bucket. */
    public function direct(): bool
    {
        return $this->storage->disk(MediaFolder::Music) instanceof AwsS3V3Adapter;
    }

    public function maxMegabytes(): int
    {
        return AudioFile::maxMegabytes($this->direct());
    }

    /**
     * Opens the upload of an audio and signs the address of each part.
     *
     * @return array{token: string, part_size: int, urls: list<string>}
     *
     * @throws AudioRejected
     */
    public function begin(User $user, string $name, int $size, TrackKind $kind): array
    {
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (! in_array($extension, AudioFile::TYPES, true)) {
            throw new AudioRejected(AudioFile::WRONG_TYPE);
        }
        if ($size > $this->maxMegabytes() * 1024 * 1024) {
            throw new AudioRejected('El audio pesa más de '.$this->maxMegabytes().' MB. Expórtalo en MP3 (128–192 kbps).');
        }

        $disk = $this->s3(AudioFile::folder($kind));
        $client = $disk->getClient();
        $bucket = $disk->getConfig()['bucket'];
        $key = $this->newKey(AudioFile::folder($kind), $extension);

        try {
            $uploadId = (string) $client->createMultipartUpload([
                'Bucket' => $bucket,
                'Key' => $disk->path($key),
                'ContentType' => AudioFile::contentType($extension),
                'CacheControl' => 'public, max-age=31536000, immutable',
                'ACL' => 'public-read',
            ])->get('UploadId');
        } catch (Throwable $exception) {
            report($exception);

            throw new AudioRejected(self::UNREACHABLE, 503);
        }

        $partSize = max(self::PART_BYTES, (int) ceil($size / self::MAX_PARTS));
        $count = (int) ceil($size / $partSize);
        $expires = now()->addHours(self::HOURS);
        $urls = [];
        for ($part = 1; $part <= $count; $part++) {
            $command = $client->getCommand('UploadPart', ['Bucket' => $bucket, 'Key' => $disk->path($key), 'UploadId' => $uploadId, 'PartNumber' => $part]);
            $urls[] = (string) $client->createPresignedRequest($command, $expires)->getUri();
        }

        $token = Str::random(40);
        Cache::put($this->cacheKey($token), [
            'user' => $user->id,
            'kind' => $kind->value,
            'key' => $key,
            'upload' => $uploadId,
            'size' => $size,
            'parts' => $count,
            'done' => false,
        ], $expires);

        return ['token' => $token, 'part_size' => $partSize, 'urls' => $urls];
    }

    /**
     * Keeps the audio a form brings (a finished direct upload or the file itself) and returns its storage key.
     *
     * @throws AudioRejected
     */
    public function receive(User $user, TrackKind $kind, ?string $token, mixed $parts, ?UploadedFile $file): string
    {
        if ($token !== null && $token !== '') {
            return $this->finish($user, $kind, $token, $parts);
        }
        if (! $file instanceof UploadedFile) {
            throw new AudioRejected('Elige el archivo de audio.');
        }

        return $this->store($file, $kind);
    }

    /** Drops an upload the browser could not finish, so its parts do not stay stored. */
    public function cancel(User $user, string $token): void
    {
        $upload = Cache::get($this->cacheKey($token));
        if (! is_array($upload) || $upload['user'] !== $user->id || $upload['done']) {
            return;
        }
        $this->abort($this->s3(AudioFile::folder(TrackKind::from($upload['kind']))), $token, $upload);
    }

    /**
     * Stores a file that came with the form.
     *
     * @throws AudioRejected
     */
    public function store(UploadedFile $file, TrackKind $kind): string
    {
        if (! $file->isValid()) {
            throw new AudioRejected(in_array($file->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
                ? 'El servidor no aceptó el archivo porque pesa demasiado. Expórtalo en MP3 (128–192 kbps) e inténtalo de nuevo.'
                : 'El archivo no llegó completo. Inténtalo de nuevo.');
        }
        $extension = strtolower($file->getClientOriginalExtension());
        if (! in_array($extension, AudioFile::TYPES, true) || ! AudioFile::looksLikeAudio((string) $file->getMimeType())) {
            throw new AudioRejected(AudioFile::WRONG_TYPE);
        }
        $max = AudioFile::maxMegabytes(false);
        if ($file->getSize() > $max * 1024 * 1024) {
            throw new AudioRejected("El audio pesa más de {$max} MB. Expórtalo en MP3 (128–192 kbps).");
        }

        $stream = fopen((string) $file->getRealPath(), 'rb');
        try {
            return $this->storage->put($stream, AudioFile::folder($kind), $extension, $this->current->id());
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }

    /**
     * Closes a direct upload. The upload is spent: the same file never ends up behind two audios.
     *
     * @throws AudioRejected
     */
    private function finish(User $user, TrackKind $kind, string $token, mixed $parts): string
    {
        $lock = Cache::lock($this->cacheKey($token).':lock', 120);
        if (! $lock->get()) {
            throw new AudioRejected('Este audio ya se está guardando. Espera un momento.', 409);
        }

        try {
            $upload = Cache::get($this->cacheKey($token));
            if (! is_array($upload) || $upload['user'] !== $user->id) {
                throw new AudioRejected(self::EXPIRED, 410);
            }
            if ($upload['kind'] !== $kind->value) {
                throw new AudioRejected('El audio se subió como otro tipo. Vuelve a subirlo.', 410);
            }
            $disk = $this->s3(AudioFile::folder($kind));
            if (! $upload['done']) {
                $this->complete($disk, $token, $upload, $parts);
                $upload['done'] = true;
                Cache::put($this->cacheKey($token), $upload, now()->addHours(self::HOURS));
            }
            $this->check($disk, $token, $upload);
            Cache::forget($this->cacheKey($token));

            return $upload['key'];
        } finally {
            $lock->release();
        }
    }

    /** @param  array{user: int, kind: string, key: string, upload: string, size: int, parts: int, done: bool}  $upload */
    private function complete(AwsS3V3Adapter $disk, string $token, array $upload, mixed $parts): void
    {
        $list = $this->parts($parts, $upload['parts']);
        if ($list === null) {
            $this->abort($disk, $token, $upload);

            throw new AudioRejected(self::EXPIRED, 410);
        }

        try {
            $disk->getClient()->completeMultipartUpload([
                'Bucket' => $disk->getConfig()['bucket'],
                'Key' => $disk->path($upload['key']),
                'UploadId' => $upload['upload'],
                'MultipartUpload' => ['Parts' => $list],
            ]);
        } catch (S3Exception $exception) {
            $code = $exception->getAwsErrorCode();
            if ($code === 'NoSuchUpload') {
                return;
            }
            if (in_array($code, ['InvalidPart', 'InvalidPartOrder', 'EntityTooSmall'], true)) {
                $this->abort($disk, $token, $upload);

                throw new AudioRejected(self::EXPIRED, 410);
            }
            report($exception);

            throw new AudioRejected(self::UNREACHABLE, 503);
        } catch (Throwable $exception) {
            report($exception);

            throw new AudioRejected(self::UNREACHABLE, 503);
        }
    }

    /**
     * Makes sure the whole file arrived and that it is audio; otherwise it is deleted.
     *
     * @param  array{user: int, kind: string, key: string, upload: string, size: int, parts: int, done: bool}  $upload
     */
    private function check(AwsS3V3Adapter $disk, string $token, array $upload): void
    {
        $client = $disk->getClient();
        $object = ['Bucket' => $disk->getConfig()['bucket'], 'Key' => $disk->path($upload['key'])];

        try {
            $size = (int) $client->headObject($object)->get('ContentLength');
            $head = (string) $client->getObject($object + ['Range' => 'bytes=0-'.(self::SNIFF_BYTES - 1)])->get('Body');
        } catch (S3Exception $exception) {
            if ($exception->getStatusCode() === 404) {
                Cache::forget($this->cacheKey($token));

                throw new AudioRejected(self::EXPIRED, 410);
            }
            report($exception);

            throw new AudioRejected(self::UNREACHABLE, 503);
        } catch (Throwable $exception) {
            report($exception);

            throw new AudioRejected(self::UNREACHABLE, 503);
        }

        $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->buffer($head);
        $problem = match (true) {
            $size !== $upload['size'] => new AudioRejected(self::EXPIRED, 410),
            ! AudioFile::looksLikeAudio($mime) => new AudioRejected(AudioFile::WRONG_TYPE),
            default => null,
        };
        if ($problem !== null) {
            $disk->delete($upload['key']);
            Cache::forget($this->cacheKey($token));

            throw $problem;
        }
    }

    /**
     * The parts in order, ready for S3, or null when they do not match the upload.
     *
     * @return list<array{PartNumber: int, ETag: string}>|null
     */
    private function parts(mixed $parts, int $count): ?array
    {
        if (is_string($parts)) {
            $parts = json_decode($parts, true);
        }
        if (! is_array($parts) || count($parts) !== $count) {
            return null;
        }
        $list = [];
        foreach ($parts as $part) {
            $number = is_array($part) ? filter_var($part['n'] ?? null, FILTER_VALIDATE_INT) : false;
            $etag = is_array($part) ? trim((string) ($part['etag'] ?? ''), '"') : '';
            if ($number === false || $number < 1 || $number > $count || isset($list[$number]) || preg_match('/^[A-Za-z0-9-]{8,80}$/', $etag) !== 1) {
                return null;
            }
            $list[$number] = ['PartNumber' => $number, 'ETag' => '"'.$etag.'"'];
        }
        ksort($list);

        return array_values($list);
    }

    /** @param  array{user: int, kind: string, key: string, upload: string, size: int, parts: int, done: bool}  $upload */
    private function abort(AwsS3V3Adapter $disk, string $token, array $upload): void
    {
        Cache::forget($this->cacheKey($token));
        try {
            $disk->getClient()->abortMultipartUpload([
                'Bucket' => $disk->getConfig()['bucket'],
                'Key' => $disk->path($upload['key']),
                'UploadId' => $upload['upload'],
            ]);
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private function s3(MediaFolder $folder): AwsS3V3Adapter
    {
        $disk = $this->storage->disk($folder);
        if (! $disk instanceof AwsS3V3Adapter) {
            throw new AudioRejected('La subida directa no está disponible en este servidor.', 409);
        }

        return $disk;
    }

    /** Same layout MediaStorage uses: "{folder}/{station}/{yyyy}/{mm}/{uuid}.{ext}". */
    private function newKey(MediaFolder $folder, string $extension): string
    {
        return implode('/', [$folder->value, (string) $this->current->id(), now()->format('Y/m'), Str::uuid()->toString().'.'.$extension]);
    }

    private function cacheKey(string $token): string
    {
        return $this->current->key('upload:'.$token);
    }
}
