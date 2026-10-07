<?php

namespace App\Domain\Studio\Library;

use App\Domain\Studio\Catalog\Names;
use App\Domain\Studio\Enums\TrackKind;
use App\Models\Track;
use Illuminate\Support\Collection;

/**
 * Tells whether an audio about to be uploaded is already in the library (or
 * twice in the same batch): the same song and cut by the same author is
 * «same»; another cut or a clearly different length is «version»; the same
 * name without a known author is «possible».
 */
final class Duplicates
{
    public const SAME = 'same';

    public const VERSION = 'version';

    public const POSSIBLE = 'possible';

    private const TITLE = 0.92;

    private const ARTIST = 0.85;

    /** Seconds two files of the same recording may differ by. */
    private const SAME_LENGTH = 3.0;

    private const MAX_MATCHES = 3;

    /**
     * @param  list<array{key: string, kind: string, title: string, artist?: ?string, duration?: ?float}>  $items
     * @return array<string, array{matches: list<array{id: string, title: string, artist: ?string, duration: float, verdict: string}>, batch: ?array{key: string, verdict: string}}>
     */
    public function check(array $items, ?string $ignore = null): array
    {
        $library = Track::query()
            ->whereIn('kind', collect($items)->pluck('kind')->unique()->values())
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore))
            ->get(['id', 'kind', 'title', 'artist', 'featured', 'duration'])
            ->groupBy(fn (Track $track) => $track->kind->value);

        $results = [];
        $seen = [];
        foreach ($items as $item) {
            $matches = collect($library->get($item['kind'], []))
                ->map(fn (Track $track) => ['track' => $track, 'verdict' => self::verdict($item, [
                    'title' => $track->title,
                    'artist' => $track->credit(),
                    'duration' => $track->duration,
                ])])
                ->filter(fn (array $match) => $match['verdict'] !== null)
                ->sortBy(fn (array $match) => array_search($match['verdict'], [self::SAME, self::VERSION, self::POSSIBLE], true))
                ->take(self::MAX_MATCHES)
                ->map(fn (array $match) => [
                    'id' => $match['track']->id,
                    'title' => $match['track']->title,
                    'artist' => $match['track']->credit(),
                    'duration' => (float) $match['track']->duration,
                    'verdict' => $match['verdict'],
                ])
                ->values()->all();

            $batch = null;
            foreach ($seen as $earlier) {
                $verdict = $earlier['kind'] === $item['kind'] ? self::verdict($item, $earlier) : null;
                if ($verdict !== null) {
                    $batch = ['key' => $earlier['key'], 'verdict' => $verdict];
                    break;
                }
            }
            $seen[] = $item;
            $results[$item['key']] = ['matches' => $matches, 'batch' => $batch];
        }

        return $results;
    }

    /** Whether a song with those details is already in the library as the very same cut. */
    public function exact(TrackKind $kind, string $title, ?string $artist, ?float $duration, ?string $ignore = null): Collection
    {
        $found = $this->check([['key' => 'new', 'kind' => $kind->value, 'title' => $title, 'artist' => $artist, 'duration' => $duration]], $ignore);

        return collect($found['new']['matches'])->where('verdict', self::SAME)->values();
    }

    /**
     * @param  array{title: string, artist?: ?string, duration?: ?float}  $a
     * @param  array{title: string, artist?: ?string, duration?: ?float}  $b
     */
    private static function verdict(array $a, array $b): ?string
    {
        if (Names::similarity(Names::baseTitle($a['title']), Names::baseTitle($b['title'])) < self::TITLE) {
            return null;
        }
        $artistA = trim((string) ($a['artist'] ?? ''));
        $artistB = trim((string) ($b['artist'] ?? ''));
        if ($artistA === '' || $artistB === '') {
            return self::POSSIBLE;
        }
        $sameAuthor = collect(Names::split($artistA))->contains(fn (string $name) => collect(Names::split($artistB))
            ->contains(fn (string $other) => Names::similarity($name, $other) >= self::ARTIST));
        if (! $sameAuthor) {
            return null;
        }
        $gap = ($a['duration'] ?? null) && ($b['duration'] ?? null) ? abs((float) $a['duration'] - (float) $b['duration']) : null;
        $sameCut = Names::versions($a['title']) == Names::versions($b['title']);

        return $sameCut && ($gap === null || $gap <= self::SAME_LENGTH) ? self::SAME : self::VERSION;
    }
}
