<?php

namespace App\Domain\Studio\Library\Identify\Sources;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * A free music database asked over HTTP. A slow or failing database never
 * breaks an upload: it just answers nothing.
 */
abstract class Source
{
    protected function client(): PendingRequest
    {
        return Http::withUserAgent((string) config('platform.media.identify.user_agent'))
            ->acceptJson()
            ->timeout(max(2, (int) config('platform.media.identify.timeout')))
            ->connectTimeout(4)
            ->retry(2, 300, fn (Throwable $error) => $error instanceof ConnectionException, throw: false);
    }

    /**
     * The JSON answer of a GET request, or null when the database fails or does not answer.
     *
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>|null
     */
    protected function json(string $url, array $query = []): ?array
    {
        try {
            $response = $this->client()->get($url, $query);
        } catch (Throwable) {
            return null;
        }
        if (! $response->successful()) {
            return null;
        }
        $data = $response->json();

        return is_array($data) && ! isset($data['error']) ? $data : null;
    }

    /** First year of a date such as «2023-10-20T12:00:00Z». */
    protected static function year(mixed $date): ?int
    {
        return is_string($date) && preg_match('/^(\d{4})/', $date, $match) === 1 && (int) $match[1] >= 1900 ? (int) $match[1] : null;
    }
}
