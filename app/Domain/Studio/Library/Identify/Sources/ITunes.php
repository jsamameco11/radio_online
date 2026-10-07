<?php

namespace App\Domain\Studio\Library\Identify\Sources;

use App\Domain\Studio\Catalog\Names;
use App\Domain\Studio\Library\Identify\Candidate;

/** Apple's iTunes Search API: credits, the album of each version, its year, a 600 px cover and Apple's genre. */
final class ITunes extends Source
{
    public const NAME = 'itunes';

    /** Album names that give away a compilation («Lo mejor de…», «Grandes éxitos», «20 Éxitos»). */
    private const COMPILATION = '/\b(lo mejor|grandes exitos|greatest hits|best of|the very best|exitos|hits|coleccion|collection|antologia|anthology|essentials|recopilacion|compilation|top \d+|\d+ (canciones|exitos|songs|temas))\b/';

    /** @return list<Candidate> */
    public function search(string $term): array
    {
        $data = $this->json('https://itunes.apple.com/search', [
            'term' => $term,
            'media' => 'music',
            'entity' => 'song',
            'limit' => 25,
            'country' => config('platform.media.identify.store_country'),
        ]);

        return collect($data['results'] ?? [])
            ->filter(fn ($item) => is_array($item) && ($item['kind'] ?? '') === 'song' && ! empty($item['trackName']) && ! empty($item['artistName']))
            ->map(fn (array $item) => $this->candidate($item))
            ->values()->all();
    }

    /** @param  array<string, mixed>  $item */
    private function candidate(array $item): Candidate
    {
        $credited = Names::split((string) $item['artistName']);
        [$album, $type] = self::release((string) ($item['collectionName'] ?? ''), (int) ($item['trackCount'] ?? 0), (string) ($item['collectionArtistName'] ?? ''));
        $cover = is_string($item['artworkUrl100'] ?? null) ? preg_replace('#/\d+x\d+bb\.(jpg|png)$#', '/600x600bb.$1', $item['artworkUrl100']) : null;

        return new Candidate(
            source: self::NAME,
            id: (string) ($item['trackId'] ?? ''),
            title: (string) $item['trackName'],
            artist: $credited[0] ?? (string) $item['artistName'],
            featured: array_slice($credited, 1),
            album: $album,
            albumType: $type,
            year: self::year($item['releaseDate'] ?? null),
            duration: isset($item['trackTimeMillis']) ? round($item['trackTimeMillis'] / 1000, 1) : null,
            cover: $cover,
            tags: ! empty($item['primaryGenreName']) ? [[(string) $item['primaryGenreName'], 1.0]] : [],
            albumId: isset($item['collectionId']) ? (string) $item['collectionId'] : null,
        );
    }

    /**
     * The album name and its kind: «Renuévame - Single» is a single, «Lo mejor de…» a compilation.
     *
     * @return array{0: ?string, 1: ?string}
     */
    private static function release(string $name, int $tracks, string $collectionArtist): array
    {
        $name = trim($name);
        if ($name === '') {
            return [null, null];
        }
        if (preg_match('/\s+-\s+single$/i', $name) === 1) {
            return [trim((string) preg_replace('/\s+-\s+single$/i', '', $name)), Candidate::SINGLE];
        }
        if (preg_match('/\s+-\s+ep$/i', $name) === 1) {
            return [trim((string) preg_replace('/\s+-\s+ep$/i', '', $name)), Candidate::EP];
        }
        if (preg_match('/\b(various artists|varios artistas|artistas varios)\b/i', $collectionArtist) === 1 || preg_match(self::COMPILATION, Names::key($name)) === 1) {
            return [$name, Candidate::COMPILATION];
        }

        return [$name, match (true) {
            $tracks >= 5 => Candidate::ALBUM,
            $tracks === 4 => Candidate::EP,
            $tracks > 0 => Candidate::SINGLE,
            default => null,
        }];
    }
}
