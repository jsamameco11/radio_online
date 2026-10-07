<?php

namespace App\Domain\Studio\Library\Identify;

use App\Domain\Studio\Catalog\MusicCatalog;
use App\Domain\Studio\Catalog\Names;
use App\Domain\Studio\Library\Identify\Sources\Deezer;
use App\Domain\Studio\Library\Identify\Sources\ITunes;
use App\Domain\Studio\Library\Identify\Sources\MusicBrainz;
use App\Domain\Studio\Library\Identify\Sources\Wikidata;
use App\Models\Genre;
use App\Models\Track;
use Illuminate\Support\Facades\Cache;

/**
 * Identifies a song on the internet before it is uploaded (or one already in
 * the library): author and co-authors, album, year, cover and genres, ready
 * to fill the form. iTunes, Deezer and MusicBrainz are asked for the song;
 * MusicBrainz and Wikidata tell what its author plays. Tags are mapped to the
 * genres of the shared catalog.
 */
final class Identifier
{
    /** Lowest match of the best version for the song to count as found. */
    private const FOUND = 0.62;

    /** Lowest match of a song name with the one asked. */
    private const SAME_TITLE = 0.8;

    public function __construct(
        private readonly ITunes $iTunes,
        private readonly Deezer $deezer,
        private readonly MusicBrainz $musicBrainz,
        private readonly Wikidata $wikidata,
        private readonly MusicCatalog $catalog,
    ) {}

    /**
     * @return array{found: bool, confidence: ?string, score: ?float, sources: list<string>, title: ?string, artist: ?string, featured: list<string>, album: ?string, year: ?int, cover_url: ?string, genres: list<array{id: string, name: string, family: string}>, identity: ?array<string, mixed>}
     */
    public function identify(SongQuery $query, ?string $fileGenre = null): array
    {
        $found = Cache::remember($query->cacheKey(), now()->addDays(7), fn () => $this->research($query));

        return $this->classify($query, $found, $fileGenre);
    }

    /** @return array<string, mixed> */
    private function research(SongQuery $query): array
    {
        $title = $query->title;
        $artist = $query->artist;
        $candidates = $artist !== ''
            ? [...$this->iTunes->search("{$artist} {$title}"), ...$this->deezer->search('artist:"'.$artist.'" track:"'.$title.'"'), ...$this->musicBrainz->search($title, $artist)]
            : [...$this->iTunes->search($title), ...$this->deezer->search($title), ...$this->musicBrainz->search($title, '')];
        $matched = $this->matched($candidates, $query);
        if ($matched === [] && $artist !== '') {
            $matched = $this->matched([...$this->deezer->search("{$artist} {$title}"), ...$this->iTunes->search($title)], $query);
        }
        if ($matched === [] || $matched[0]->score < self::FOUND) {
            return ['found' => false];
        }

        $best = $matched[0];
        $same = array_values(array_filter($matched, fn (Candidate $candidate) => Names::similarity($candidate->artist, $best->artist) >= 0.85));
        foreach (collect($same)->where('source', Deezer::NAME)->unique('albumId')->take(3) as $candidate) {
            $this->deezer->completeAlbum($candidate);
        }
        $deezer = collect($same)->firstWhere('source', Deezer::NAME);
        if ($deezer instanceof Candidate) {
            $this->deezer->completeCredits($deezer);
        }

        $album = collect($same)->first(fn (Candidate $candidate) => $candidate->onAlbum() && $candidate->score >= $best->score - 0.08)
            ?? collect($same)->first(fn (Candidate $candidate) => $candidate->album !== null && $candidate->albumType !== Candidate::COMPILATION);
        $years = collect($same)->filter(fn (Candidate $candidate) => $candidate->year !== null && $candidate->albumType !== Candidate::COMPILATION)->pluck('year');
        $sources = collect($same)->pluck('source')->unique()->values()->all();
        $first = fn (string $source) => collect($same)->firstWhere('source', $source);

        $mbArtist = collect($same)->first(fn (Candidate $candidate) => $candidate->source === MusicBrainz::NAME && $candidate->artistId);
        $artistInfo = $mbArtist ? $this->musicBrainz->artist((string) $mbArtist->artistId) : null;
        $wiki = $artistInfo === null || $artistInfo['tags'] === [] ? $this->wikidata->artist($best->artist) : null;
        if ($wiki !== null) {
            $sources[] = Wikidata::NAME;
        }

        return [
            'found' => true,
            'score' => round($best->score, 3),
            'confidence' => match (true) {
                $best->score >= 0.88 && count($sources) >= 2 => 'high',
                $best->score >= 0.75 => 'medium',
                default => 'low',
            },
            'sources' => array_values(array_unique($sources)),
            'title' => Names::cleanTitle($best->title),
            'artist' => Names::cleanArtist($best->artist),
            'featured' => Names::unique(collect($same)->flatMap(fn (Candidate $candidate) => $candidate->featured)
                ->reject(fn (string $name) => Names::similarity($name, $best->artist) >= 0.86)->all()),
            'album' => $album?->album,
            'year' => $years->min(),
            'cover' => ($album ?? $best)->cover ?? collect($same)->pluck('cover')->filter()->first(),
            'tags' => [
                ...collect($same)->flatMap(fn (Candidate $candidate) => $candidate->tags)->all(),
                ...($artistInfo['tags'] ?? []),
                ...($wiki['tags'] ?? []),
            ],
            'artist_info' => [
                'kind' => $artistInfo['kind'] ?? $wiki['kind'] ?? null,
                'country' => $artistInfo['country'] ?? null,
                'musicbrainz_id' => $mbArtist?->artistId,
            ],
            'ids' => array_filter([
                'musicbrainz' => $first(MusicBrainz::NAME)?->id,
                'deezer' => $first(Deezer::NAME)?->id,
                'itunes' => $first(ITunes::NAME)?->id,
                'isrc' => $deezer?->isrc,
            ]),
        ];
    }

    /**
     * Versions whose name is the song asked, best match first.
     *
     * @param  list<Candidate>  $candidates
     * @return list<Candidate>
     */
    private function matched(array $candidates, SongQuery $query): array
    {
        $matched = [];
        foreach ($candidates as $candidate) {
            $title = Names::similarity(Names::baseTitle($candidate->title), Names::baseTitle($query->title));
            if ($title < self::SAME_TITLE) {
                continue;
            }
            $names = $query->names();
            $artist = $names === [] ? 0.7 : max(array_map(
                fn (string $name) => max(array_map(fn (string $credited) => Names::similarity($credited, $name), [$candidate->artist, ...$candidate->featured])),
                $names,
            ));
            $gap = $candidate->gap($query->duration);
            $length = match (true) {
                $gap === null => 0.6,
                $gap <= 2 => 1.0,
                $gap <= 5 => 0.85,
                $gap <= 12 => 0.5,
                default => 0.15,
            };
            $version = Names::versions($candidate->title.' '.($candidate->album ?? '')) == $query->versions ? 0.0 : -0.08;
            $candidate->score = max(0.0, $title * 0.45 + $artist * 0.4 + $length * 0.15 + $version);
            $matched[] = $candidate;
        }
        $rank = [ITunes::NAME => 0, Deezer::NAME => 1, MusicBrainz::NAME => 2];
        usort($matched, fn (Candidate $a, Candidate $b) => [$b->score, $rank[$a->source] ?? 3] <=> [$a->score, $rank[$b->source] ?? 3]);

        return $matched;
    }

    /**
     * What the form receives: the song found (or what was asked) with its genres from the catalog.
     *
     * @param  array<string, mixed>  $found
     * @return array{found: bool, confidence: ?string, score: ?float, sources: list<string>, title: ?string, artist: ?string, featured: list<string>, album: ?string, year: ?int, cover_url: ?string, genres: list<array{id: string, name: string, family: string}>, identity: ?array<string, mixed>}
     */
    private function classify(SongQuery $query, array $found, ?string $fileGenre): array
    {
        $artist = $found['artist'] ?? ($query->artist !== '' ? $query->artist : null);
        $scores = [];
        $add = function (?Genre $genre, float $weight) use (&$scores) {
            if ($genre !== null) {
                $scores[$genre->id] = ['genre' => $genre, 'score' => ($scores[$genre->id]['score'] ?? 0.0) + $weight];
            }
        };
        foreach ($found['tags'] ?? [] as [$tag, $weight]) {
            $add($this->catalog->genre($tag), (float) $weight);
        }
        foreach ($this->catalog->artist($artist)?->genres ?? [] as $position => $genre) {
            $add($genre, 2.0 - $position * 0.3);
        }
        $add($this->catalog->genre($fileGenre), 1.0);
        uasort($scores, fn (array $a, array $b) => $b['score'] <=> $a['score']);
        $top = $scores === [] ? 0.0 : reset($scores)['score'];
        $genres = collect($scores)->filter(fn (array $entry) => $entry['score'] >= max(0.9, $top * 0.4))
            ->take(Track::MAX_GENRES - 1)
            ->map(fn (array $entry) => $entry['genre']->brief())
            ->values()->all();

        $isFound = (bool) $found['found'];

        return [
            'found' => $isFound,
            'confidence' => $found['confidence'] ?? null,
            'score' => $found['score'] ?? null,
            'sources' => $found['sources'] ?? [],
            'title' => $found['title'] ?? ($query->title !== '' ? $query->title : null),
            'artist' => $artist,
            'featured' => array_slice(Names::unique([...($found['featured'] ?? []), ...$query->featured]), 0, Track::MAX_FEATURED),
            'album' => $found['album'] ?? null,
            'year' => $found['year'] ?? null,
            'cover_url' => $found['cover'] ?? null,
            'genres' => $genres,
            'identity' => $isFound ? [
                'confidence' => $found['confidence'],
                'score' => $found['score'],
                'sources' => $found['sources'],
                'ids' => $found['ids'],
                'artist' => array_filter($found['artist_info']),
            ] : null,
        ];
    }
}
