<?php

namespace App\Domain\Storage;

use DateTimeInterface;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * The only door to media files: uploads, URLs and deletions go through here,
 * so the rest of the application never knows whether files live in Wasabi
 * (production) or on the local disks (development and tests).
 *
 * Objects are keyed "{folder}/{station}/{yyyy}/{mm}/{uuid}.{ext}"; the
 * database stores that key, never the file.
 */
final class MediaStorage
{
    public function disk(MediaFolder $folder): Filesystem
    {
        return Storage::disk($this->diskName($folder));
    }

    public function diskName(MediaFolder $folder): string
    {
        return (string) config($folder->isPrivate() ? 'filesystems.media.private' : 'filesystems.media.public');
    }

    /**
     * Stores an upload and returns its object key.
     */
    public function store(UploadedFile $file, MediaFolder $folder, int|string|null $owner = null): string
    {
        $key = $this->newKey($folder, $owner, $file->guessExtension() ?: $file->getClientOriginalExtension() ?: 'bin');
        $this->disk($folder)->putFileAs(dirname($key), $file, basename($key));

        return $key;
    }

    /**
     * Stores raw contents (e.g. a rendered audio) and returns its object key.
     *
     * @param  string|resource  $contents
     */
    public function put(mixed $contents, MediaFolder $folder, string $extension, int|string|null $owner = null): string
    {
        $key = $this->newKey($folder, $owner, $extension);
        $this->disk($folder)->put($key, $contents);

        return $key;
    }

    /**
     * A URL the browser can load: permanent for public folders, signed and
     * short-lived for private ones.
     */
    public function url(?string $key, ?DateTimeInterface $expiresAt = null): ?string
    {
        if ($key === null || $key === '') {
            return null;
        }

        if (Str::startsWith($key, ['http://', 'https://'])) {
            return $key;
        }

        $folder = $this->folderOf($key);
        $disk = $this->disk($folder);

        if (! $folder->isPrivate()) {
            return $disk->url($key);
        }

        return $disk->temporaryUrl($key, $expiresAt ?? now()->addMinutes(30));
    }

    public function exists(?string $key): bool
    {
        return $key !== null && $key !== '' && $this->disk($this->folderOf($key))->exists($key);
    }

    public function delete(?string $key): void
    {
        if ($key === null || $key === '' || Str::startsWith($key, ['http://', 'https://'])) {
            return;
        }
        $folder = $this->folderOf($key);
        if (! $folder->isShared()) {
            $this->disk($folder)->delete($key);
        }
    }

    public function folderOf(string $key): MediaFolder
    {
        return MediaFolder::tryFrom(Str::before($key, '/')) ?? MediaFolder::Music;
    }

    private function newKey(MediaFolder $folder, int|string|null $owner, string $extension): string
    {
        return implode('/', array_filter([
            $folder->value,
            $owner === null ? 'platform' : (string) $owner,
            now()->format('Y/m'),
            Str::uuid()->toString().'.'.strtolower(ltrim($extension, '.')),
        ]));
    }
}
