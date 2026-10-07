<?php

namespace App\Domain\Studio\Library\Identify;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaFolder;
use App\Domain\Storage\MediaStorage;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Keeps a copy of the cover the identification found, so the library never
 * depends on another site. Only the image services of the music databases
 * are fetched, never any address a form sends.
 */
final class CoverDownload
{
    private const HOSTS = ['mzstatic.com', 'dzcdn.net', 'coverartarchive.org', 'archive.org'];

    private const MAX_BYTES = 6 * 1024 * 1024;

    private const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function __construct(
        private readonly MediaStorage $storage,
        private readonly CurrentStation $current,
    ) {}

    public static function allowed(?string $url): bool
    {
        if (! is_string($url) || ! str_starts_with($url, 'https://')) {
            return false;
        }
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        return collect(self::HOSTS)->contains(fn (string $allowed) => $host === $allowed || str_ends_with($host, '.'.$allowed));
    }

    /** The storage key of the copy, or null when the image cannot be fetched. */
    public function fetch(?string $url): ?string
    {
        if (! self::allowed($url)) {
            return null;
        }
        try {
            $response = Http::timeout(10)->connectTimeout(4)->withUserAgent((string) config('platform.media.identify.user_agent'))->get($url);
        } catch (Throwable) {
            return null;
        }
        $type = strtolower(trim(explode(';', (string) $response->header('Content-Type'))[0]));
        $body = $response->body();
        if (! $response->successful() || ! isset(self::TYPES[$type]) || $body === '' || strlen($body) > self::MAX_BYTES) {
            return null;
        }

        return $this->storage->put($body, MediaFolder::Covers, self::TYPES[$type], $this->current->id());
    }
}
