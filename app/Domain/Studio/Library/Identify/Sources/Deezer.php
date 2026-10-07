<?php

namespace App\Domain\Studio\Library\Identify\Sources;

use App\Domain\Studio\Catalog\Names;
use App\Domain\Studio\Library\Identify\Candidate;
use Illuminate\Support\Facades\Cache;

/** Deezer's public API: the song, the kind of release it is on, its year, genres, credits and ISRC. */
final class Deezer extends Source
{
    public const NAME = 'deezer';

    private const TYPES = ['album' => Candidate::ALBUM, 'ep' => Candidate::EP, 'single' => Candidate::SINGLE, 'compile' => Candidate::COMPILATION];

    /** @return list<Candidate> */
    public function search(string $query): array
    {
        $data = $this->json('https://api.deezer.com/search', ['q' => $query, 'limit' => 25]);

        return collect($data['data'] ?? [])
            ->filter(fn ($item) => is_array($item) && ($item['type'] ?? 'track') === 'track' && ! empty($item['title']) && ! empty($item['artist']['name']))
            ->map(fn (array $item) => new Candidate(
                source: self::NAME,
                id: (string) $item['id'],
                title: (string) $item['title'],
                artist: (string) $item['artist']['name'],
                album: ! empty($item['album']['title']) ? (string) $item['album']['title'] : null,
                duration: isset($item['duration']) ? (float) $item['duration'] : null,
                cover: $item['album']['cover_xl'] ?? null,
                artistId: isset($item['artist']['id']) ? (string) $item['artist']['id'] : null,
                albumId: isset($item['album']['id']) ? (string) $item['album']['id'] : null,
            ))
            ->values()->all();
    }

    /** Completes a version with what its album says: kind of release, year and genres. */
    public function completeAlbum(Candidate $candidate): void
    {
        if (! $candidate->albumId) {
            return;
        }
        $album = Cache::remember('identify:deezer-album:'.$candidate->albumId, now()->addDays(30), fn () => $this->json('https://api.deezer.com/album/'.$candidate->albumId));
        if (! is_array($album)) {
            return;
        }
        $candidate->albumType = self::TYPES[$album['record_type'] ?? ''] ?? $candidate->albumType;
        $candidate->year ??= self::year($album['release_date'] ?? null);
        $candidate->cover = $album['cover_xl'] ?? $candidate->cover;
        $candidate->tags = collect($album['genres']['data'] ?? [])->pluck('name')->filter()->map(fn ($name) => [(string) $name, 1.5])->values()->all();
    }

    /** Completes a version with its credits (main and featured artists) and its ISRC. */
    public function completeCredits(Candidate $candidate): void
    {
        $track = $this->json('https://api.deezer.com/track/'.$candidate->id);
        if (! $track) {
            return;
        }
        $others = collect($track['contributors'] ?? [])
            ->filter(fn ($person) => ! empty($person['name']) && in_array($person['role'] ?? 'Main', ['Main', 'Featured'], true))
            ->pluck('name')
            ->reject(fn (string $name) => Names::key($name) === Names::key($candidate->artist));
        $candidate->featured = Names::unique([...$candidate->featured, ...$others->all()]);
        $candidate->isrc = is_string($track['isrc'] ?? null) ? $track['isrc'] : null;
        $candidate->year ??= self::year($track['release_date'] ?? null);
    }
}
