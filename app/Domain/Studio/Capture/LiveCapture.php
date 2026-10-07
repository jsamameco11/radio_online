<?php

namespace App\Domain\Studio\Capture;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaFolder;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Broadcast\LiveDesk;
use App\Domain\Studio\Broadcast\Timeline;
use App\Domain\Studio\Enums\RecordingStatus;
use App\Models\Recording;
use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Records a console transmission of the current station in order.
 *
 * The browser sends the microphone that went on air in short pieces. Each piece is appended,
 * never rewritten, so a dropped connection still leaves the audio already received. When the
 * transmission closes, the pieces are joined into one private file (MediaFolder::Recordings)
 * and the recording waits for the operator to keep it as a library audio or discard it.
 */
final class LiveCapture
{
    /** Opus at the console bitrate stays under this for a transmission of about four hours. */
    public const MAX_MB = 120;

    public const CHUNK_MB = 8;

    /** Seconds without a piece after which an open recording counts as abandoned. */
    private const STALE_SECONDS = 25;

    /** Smaller recordings hold nothing worth keeping. */
    private const MIN_BYTES = 8000;

    public function __construct(
        private readonly CurrentStation $current,
        private readonly MediaStorage $storage,
        private readonly LiveDesk $desk,
    ) {}

    /**
     * Opens the recording of the transmission on air now.
     *
     * @throws CaptureRejected
     */
    public function open(User $user, string $session): Recording
    {
        $session = Str::lower(trim($session));
        if (! preg_match('/^[a-z0-9]{16,40}$/', $session) || $this->desk->stored()['session'] !== $session) {
            throw new CaptureRejected('Abre la transmisión en vivo para empezar a grabar.', 409);
        }

        return $this->exclusive($user, function () use ($user, $session) {
            $current = $this->unfinished($user);
            if ($current && $current->session === $session && $this->status($current) === RecordingStatus::Recording) {
                return $current;
            }
            if ($current && $this->status($current) === RecordingStatus::Recording && $current->updated_at->lt(now()->subSeconds(self::STALE_SECONDS))) {
                $this->seal($current, (float) $current->duration);
                $current->refresh();
            }
            if ($current && $this->status($current)->isOpen()) {
                throw new CaptureRejected('Hay una grabación anterior sin guardar. Guárdala o descártala para grabar esta transmisión.', 409, $current);
            }

            return Recording::query()->create([
                'user_id' => $user->id,
                'session' => $session,
                'status' => RecordingStatus::Recording->value,
                'extension' => 'webm',
                'mime' => 'audio/webm',
                'bytes' => 0,
                'parts' => 0,
                'started_at' => now(),
            ]);
        });
    }

    /**
     * Appends the next piece. Pieces already stored are accepted again, so a retry does not
     * duplicate audio ($have is set to true then).
     *
     * @throws CaptureRejected
     */
    public function append(User $user, Recording $recording, int $index, UploadedFile $chunk, string $extension, bool &$have = false): Recording
    {
        if (! $chunk->isValid()) {
            throw new CaptureRejected('Un tramo de la grabación no llegó completo. Se sigue grabando.');
        }

        return $this->exclusive($user, function () use ($recording, $index, $chunk, $extension, &$have) {
            $recording->refresh();
            if ($this->status($recording) !== RecordingStatus::Recording) {
                throw new CaptureRejected('Esta grabación ya no está abierta.', 409);
            }
            if ($index < $recording->parts) {
                $have = true;

                return $recording;
            }
            if ($index !== $recording->parts) {
                throw new CaptureRejected('Falta un tramo anterior de la grabación.', 409, null, 'gap');
            }
            $next = $recording->bytes + (int) $chunk->getSize();
            if ($next > self::MAX_MB * 1024 * 1024) {
                $this->seal($recording, (float) $recording->duration);

                throw new CaptureRejected('La grabación llegó al máximo de '.self::MAX_MB.' MB. Guarda lo que ya se grabó.', 413, $recording->refresh(), 'full');
            }
            if ($recording->parts === 0 && ! self::header($chunk, $extension)) {
                throw new CaptureRejected('El audio de la grabación no es válido.');
            }
            if ($recording->parts === 0) {
                $recording->extension = $extension;
                $recording->mime = $extension === 'm4a' ? 'audio/mp4' : 'audio/webm';
            }
            $this->parts()->put($this->partKey($recording, $index), (string) $chunk->get());
            $recording->bytes = $next;
            $recording->parts++;
            $recording->save();

            return $recording;
        });
    }

    /** Stops accepting audio and joins the pieces. A recording too short to be kept is discarded. */
    public function close(User $user, Recording $recording, float $duration): Recording
    {
        return $this->exclusive($user, function () use ($recording, $duration) {
            $recording->refresh();
            if ($this->status($recording) === RecordingStatus::Recording) {
                $this->seal($recording, $duration);
            }

            return $recording->refresh();
        });
    }

    /** Discards a recording the operator does not want; its audio is deleted. */
    public function discard(User $user, Recording $recording): bool
    {
        return $this->exclusive($user, function () use ($recording) {
            $recording->refresh();
            if (! $this->status($recording)->isOpen()) {
                return false;
            }
            $this->erase($recording);
            $recording->update(['status' => RecordingStatus::Discarded->value]);

            return true;
        });
    }

    /** @return array<string, mixed>|null the operator's recording still to be kept or discarded */
    public function pending(User $user): ?array
    {
        $recording = $this->unfinished($user);
        if (! $recording || $recording->bytes < 1) {
            return null;
        }

        return [
            ...self::brief($recording),
            'stale' => $this->status($recording) === RecordingStatus::Recording && $recording->updated_at->lt(now()->subSeconds(self::STALE_SECONDS)),
        ];
    }

    /** @return array<string, mixed> */
    public static function brief(Recording $recording): array
    {
        $status = RecordingStatus::from((string) $recording->status);

        return [
            'id' => $recording->id,
            'session' => $recording->session,
            'status' => $status->value,
            'status_label' => $status->label(),
            'bytes' => $recording->bytes,
            'parts' => $recording->parts,
            'duration' => $recording->duration !== null ? (float) $recording->duration : null,
            'started_at' => $recording->started_at?->toIso8601String(),
        ];
    }

    /**
     * Discards recordings of every station left open or unsaved for days, and deletes their files.
     *
     * @return int recordings discarded
     */
    public function purge(): int
    {
        $stale = Recording::acrossStations()
            ->whereIn('status', [RecordingStatus::Recording->value, RecordingStatus::Ready->value])
            ->where('updated_at', '<', now()->subDays((int) config('platform.streaming.recording_days', 2)))
            ->get();
        foreach ($stale as $recording) {
            $this->erase($recording);
            $recording->update(['status' => RecordingStatus::Discarded->value]);
        }

        return $stale->count();
    }

    private function status(Recording $recording): RecordingStatus
    {
        return RecordingStatus::from((string) $recording->status);
    }

    private function unfinished(User $user): ?Recording
    {
        return Recording::query()
            ->where('user_id', $user->id)
            ->whereIn('status', [RecordingStatus::Recording->value, RecordingStatus::Ready->value])
            ->orderByDesc('created_at')
            ->first();
    }

    /**
     * One operator appends to a single recording at a time.
     *
     * @template TResult
     *
     * @param  callable(): TResult  $callback
     * @return TResult
     */
    private function exclusive(User $user, callable $callback): mixed
    {
        return Cache::lock($this->current->key('capture.'.$user->id), 20)->block(8, $callback);
    }

    /** Joins the pieces into the private recording file, or discards it when there is nothing worth keeping. */
    private function seal(Recording $recording, float $duration): void
    {
        $seconds = $this->duration($recording, $duration);
        $key = $recording->bytes >= self::MIN_BYTES && $seconds >= 1 ? $this->combine($recording) : null;
        $this->parts()->deleteDirectory($this->partsDirectory($recording));
        if ($key === null) {
            $recording->update(['status' => RecordingStatus::Discarded->value, 'finished_at' => now(), 'duration' => round($seconds, 2)]);

            return;
        }
        $recording->update([
            'status' => RecordingStatus::Ready->value,
            'path' => $key,
            'finished_at' => now(),
            'duration' => round(min(Timeline::MAX_BLOCK, $seconds), 2),
        ]);
    }

    /** Prefers the console clock, and falls back to the file size when that clock is not believable. */
    private function duration(Recording $recording, float $given): float
    {
        $given = max(0, min(Timeline::MAX_BLOCK, $given));
        $bitrate = max(16, (int) ($this->current->get()->bitrate_kbps ?: 64)) * 1000;
        $estimate = $recording->bytes > 0 ? ($recording->bytes * 8) / $bitrate : 0;
        if ($estimate > 1 && ($given < $estimate * 0.4 || $given > $estimate * 3)) {
            return $estimate;
        }

        return $given;
    }

    /** Copies the pieces in order into one private file and returns its storage key. */
    private function combine(Recording $recording): ?string
    {
        $joined = fopen('php://temp', 'w+b');
        if ($joined === false) {
            return null;
        }
        try {
            for ($index = 0; $index < $recording->parts; $index++) {
                $part = $this->parts()->readStream($this->partKey($recording, $index));
                if (! is_resource($part)) {
                    return null;
                }
                stream_copy_to_stream($part, $joined);
                fclose($part);
            }
            rewind($joined);

            return $this->storage->put($joined, MediaFolder::Recordings, $recording->extension ?: 'webm', $this->current->id());
        } catch (Throwable $exception) {
            Log::warning('Studio: a live recording could not be stored.', ['recording' => $recording->id, 'error' => $exception->getMessage()]);

            return null;
        } finally {
            fclose($joined);
        }
    }

    private function erase(Recording $recording): void
    {
        $this->parts()->deleteDirectory($this->partsDirectory($recording));
        $this->storage->delete($recording->path);
    }

    private static function header(UploadedFile $chunk, string $extension): bool
    {
        $handle = fopen((string) $chunk->getRealPath(), 'rb');
        if ($handle === false) {
            return false;
        }
        $bytes = fread($handle, 16) ?: '';
        fclose($handle);
        if ($extension === 'webm') {
            return str_starts_with($bytes, "\x1A\x45\xDF\xA3");
        }

        return strlen($bytes) >= 8 && substr($bytes, 4, 4) === 'ftyp';
    }

    /** Pieces wait on the server's own disk until the transmission closes. */
    private function parts(): Filesystem
    {
        return Storage::disk('local');
    }

    private function partsDirectory(Recording $recording): string
    {
        return 'recording-parts/'.$recording->station_id.'/'.$recording->id;
    }

    private function partKey(Recording $recording, int $index): string
    {
        return $this->partsDirectory($recording).'/'.str_pad((string) $index, 5, '0', STR_PAD_LEFT).'.part';
    }
}
