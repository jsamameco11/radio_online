<?php

namespace App\Domain\Studio\Library;

use App\Domain\Studio\Catalog\Names;
use App\Models\Artist;
use App\Models\Track;
use Illuminate\Support\Str;

/**
 * Tells whether two songs are the same one, the way a music librarian would: by
 * the name without labels, credits or version notes, the authors and guests
 * (catalog spellings included), the length, the album, the year and the codes
 * the music databases gave the recording.
 *
 * The verdict is «same» (the same recording: uploading it again duplicates it),
 * «version» (the same song in another cut: live, acoustic, remix, another
 * recording) or «possible» (too alike to let it pass unseen, too different to
 * call it the same). Different songs get no verdict.
 */
final class SameSong
{
    public const SAME = 'same';

    public const VERSION = 'version';

    public const POSSIBLE = 'possible';

    /** Seconds two copies of one recording may differ: encoders and trimmed silences. */
    private const SAME_LENGTH = 2.0;

    /** Up to here the difference may be a longer fade; beyond it, a video intro or another recording. */
    private const CLOSE_LENGTH = 5.0;

    /** Beyond this the lengths speak of another recording. */
    private const OTHER_LENGTH = 20.0;

    /** Name similarity from which two names are the same name written differently. */
    private const SAME_NAME = 0.9;

    /** Name similarity from which two names are worth a look. */
    private const CLOSE_NAME = 0.8;

    /** Words that mark a recorded-live version. */
    private const LIVE = '/\b(live|en vivo|ao vivo|en directo|directo|desde casa|sesion en vivo)\b/i';

    /** Notes that make another cut of a song, in brackets or after a dash. */
    private const CUTS = '/\b(remix|rmx|mix|reloaded|reimagined|re imagined|rework|redux|revisited|re recorded|rerecorded|re record|new version|nueva version|radio version|sped up|speed up|slowed|reverb|nightcore|8d|instrumental|pista|karaoke|backing track|performance track|playback|acoustic|acustico|unplugged|stripped|piano|demo|extended|edit|club|dub|cover|tribute|made popular|in the style of|spanish|english|portuguese|espanol|ingles|portugues|versao|lofi|lo fi|orchestral|sinfonico|symphonic|a cappella|acapella|session|sessions|medley|popurri|mashup|reprise|interlude|intro|outro|vip|bootleg)\b/';

    /** Cuts that are the same kind of version, under the words a person reads. */
    private const CUT_GROUPS = [
        'en vivo' => ['live'],
        'un remix o una edición especial' => ['remix', 'rmx', 'mix', 'reloaded', 'rework', 'vip', 'bootleg', 'club', 'dub', 'extended', 'edit', 'radio version'],
        'una versión regrabada o reimaginada' => ['reimagined', 're imagined', 'redux', 'revisited', 're recorded', 'rerecorded', 're record', 'new version', 'nueva version'],
        'acelerada, lenta o lo-fi' => ['sped up', 'speed up', 'slowed', 'reverb', 'nightcore', '8d', 'lofi', 'lo fi'],
        'instrumental, pista o a capela' => ['instrumental', 'pista', 'karaoke', 'backing track', 'performance track', 'playback', 'a cappella', 'acapella'],
        'acústica' => ['acoustic', 'acustico', 'unplugged', 'stripped', 'piano', 'session', 'sessions'],
        'un cover' => ['cover', 'tribute', 'made popular', 'in the style of'],
        'en otro idioma' => ['spanish', 'english', 'portuguese', 'espanol', 'ingles', 'portugues', 'versao'],
        'sinfónica' => ['orchestral', 'sinfonico', 'symphonic'],
        'un popurrí' => ['medley', 'popurri', 'mashup'],
        'un demo' => ['demo'],
        'un reprise, intro o interludio' => ['reprise', 'interlude', 'intro', 'outro'],
    ];

    /** Codes of the music databases, by what they prove when two songs share them. */
    private const IDS = [
        'isrc' => 'mismo código ISRC',
        'musicbrainz' => 'misma grabación en MusicBrainz',
        'deezer' => 'misma grabación en Deezer',
        'itunes' => 'misma grabación en Apple Music',
    ];

    private const RANK = [self::SAME => 0, self::POSSIBLE => 1, self::VERSION => 2];

    /** Matches given for each song, the most serious first. */
    private const MAX_MATCHES = 4;

    /** @var array{aliases: array<string, string>, joined: list<string>}|null */
    private ?array $catalog = null;

    /**
     * Every song of an upload compared with the library and with the songs before it in the same upload.
     * With `$only`, just those songs are judged (the rest only count as songs before them), so a long
     * upload asks again only for the songs that changed.
     *
     * @param  array<string, array<string, mixed>>  $songs  By the key the browser gave them, in upload order.
     * @param  iterable<Track>  $library
     * @param  list<string>|null  $only
     * @return array<string, list<array{verdict: string, reasons: list<string>, track?: Track, batch?: string}>>
     */
    public function review(array $songs, iterable $library, ?array $only = null): array
    {
        $judged = $only === null ? null : array_flip($only);
        $tracks = [];
        foreach ($library as $track) {
            $tracks[] = [$track, $this->facts(self::songOf($track))];
        }

        $results = [];
        $earlier = [];
        foreach ($songs as $key => $song) {
            $key = (string) $key;
            $facts = $this->facts($song);
            if ($judged !== null && ! isset($judged[$key])) {
                $earlier[$key] = $facts;

                continue;
            }
            $swapped = $this->swapped($song);
            $matches = [];
            foreach ($tracks as [$track, $other]) {
                if ($verdict = $this->judgeBothWays($facts, $swapped, $other)) {
                    $matches[] = [...$verdict, 'track' => $track];
                }
            }
            foreach ($earlier as $earlierKey => $other) {
                if ($verdict = $this->judgeBothWays($facts, $swapped, $other)) {
                    $matches[] = [...$verdict, 'batch' => (string) $earlierKey];
                }
            }
            usort($matches, fn (array $a, array $b) => self::RANK[$a['verdict']] <=> self::RANK[$b['verdict']]);
            $results[$key] = array_slice($matches, 0, self::MAX_MATCHES);
            $earlier[$key] = $facts;
        }

        return $results;
    }

    /**
     * The song of the library an upload would duplicate, or null.
     *
     * @param  array<string, mixed>  $song
     * @param  iterable<Track>  $library
     */
    public function twinIn(array $song, iterable $library): ?Track
    {
        $facts = $this->facts($song);
        $swapped = $this->swapped($song);
        foreach ($library as $track) {
            if (($this->judgeBothWays($facts, $swapped, $this->facts(self::songOf($track)))['verdict'] ?? null) === self::SAME) {
                return $track;
            }
        }

        return null;
    }

    /**
     * The song read with its name and author the other way round, as file names often come
     * («Pedro Navaja - Rubén Blades»); null when it names no author.
     *
     * @param  array<string, mixed>  $song
     * @return array<string, mixed>|null
     */
    private function swapped(array $song): ?array
    {
        $artist = trim((string) ($song['artist'] ?? ''));

        return $artist === '' ? null : $this->facts([...$song, 'title' => $artist, 'artist' => (string) ($song['title'] ?? ''), 'featured' => []]);
    }

    /**
     * The verdict as the song was written, or as read the other way round when that makes it the same
     * song (or a possible duplicate) of the other one; another version read backwards is not worth a word.
     *
     * @param  array<string, mixed>  $facts
     * @param  array<string, mixed>|null  $swapped
     * @param  array<string, mixed>  $other
     * @return array{verdict: string, reasons: list<string>}|null
     */
    private function judgeBothWays(array $facts, ?array $swapped, array $other): ?array
    {
        $verdict = $this->judge($facts, $other);
        if ($swapped === null || ($verdict['verdict'] ?? null) === self::SAME) {
            return $verdict;
        }
        $reversed = $this->judge($swapped, $other);
        if (! $reversed || $reversed['verdict'] === self::VERSION || ($verdict && self::RANK[$verdict['verdict']] <= self::RANK[$reversed['verdict']])) {
            return $verdict;
        }

        return ['verdict' => $reversed['verdict'], 'reasons' => ['nombre y autor al revés', ...$reversed['reasons']]];
    }

    /** @return array<string, mixed> */
    private static function songOf(Track $track): array
    {
        return [
            'title' => $track->title,
            'artist' => $track->artist,
            'featured' => $track->featured ?? [],
            'album' => $track->album,
            'year' => $track->year,
            'duration' => $track->duration,
            'ids' => (array) ($track->identity['ids'] ?? []),
        ];
    }

    /**
     * What is compared of a song, read once.
     *
     * @param  array<string, mixed>  $song
     * @return array{title: string, numbers: list<int>, lead: string, names: list<string>, album: string, albumName: string, year: ?int, duration: ?float, cuts: list<string>, ids: array<string, string>}
     */
    private function facts(array $song): array
    {
        $catalog = $this->catalog();
        $title = trim((string) preg_replace('/^\s*\d{1,3}\s*[-.)]\s+/u', '', (string) ($song['title'] ?? '')));
        preg_match_all('/\d+/', Names::key(Names::cleanTitle($title)), $numbers);
        $credited = trim((string) ($song['artist'] ?? '')) === '' ? [] : Names::split((string) $song['artist'], $catalog['joined']);
        $names = [];
        foreach ([...$credited, ...array_filter((array) ($song['featured'] ?? []), 'is_string')] as $name) {
            $key = Names::key($name);
            $names[] = $catalog['aliases'][$key] ?? $key;
        }
        $albumName = trim((string) ($song['album'] ?? ''));
        $album = $albumName !== '' ? self::albumKey($albumName) : '';
        if ($album === Names::baseTitle($title)) {
            $album = '';
        }
        $year = is_numeric($song['year'] ?? null) ? (int) $song['year'] : null;
        $duration = is_numeric($song['duration'] ?? null) && (float) $song['duration'] > 0 ? (float) $song['duration'] : null;
        $ids = [];
        foreach ((array) ($song['ids'] ?? []) as $source => $id) {
            if (isset(self::IDS[$source]) && is_scalar($id) && (string) $id !== '') {
                $ids[$source] = strtoupper((string) $id);
            }
        }

        return [
            'title' => $title,
            'numbers' => collect($numbers[0])->map(fn (string $number) => (int) $number)->unique()->sort()->values()->all(),
            'lead' => $credited[0] ?? '',
            'names' => array_values(array_unique(array_filter($names))),
            'album' => $album,
            'albumName' => $albumName,
            'year' => $year && $year >= 1900 ? $year : null,
            'duration' => $duration,
            'cuts' => self::cuts($title, $albumName),
            'ids' => $ids,
        ];
    }

    /**
     * Catalog spellings by key, pointing to the key of the artist name, and the names that hold a
     * separator and must stay whole when credits are split («Wisin & Yandel»).
     *
     * @return array{aliases: array<string, string>, joined: list<string>}
     */
    private function catalog(): array
    {
        if ($this->catalog !== null) {
            return $this->catalog;
        }
        $aliases = [];
        $joined = [];
        foreach (Artist::query()->get(['name', 'aliases']) as $artist) {
            $main = Names::key($artist->name);
            foreach ([$artist->name, ...($artist->aliases ?? [])] as $spelling) {
                $aliases[Names::key($spelling)] = $main;
                if (preg_match('/[,;\/&+]|\s(x|feat\.?|ft\.?)\s/iu', (string) $spelling) === 1) {
                    $joined[] = (string) $spelling;
                }
            }
        }

        return $this->catalog = ['aliases' => $aliases, 'joined' => $joined];
    }

    /**
     * The kinds of version a song is, by the words of its name and album: «Oceans (Live)» → [en vivo];
     * a studio version on a live album is not live.
     *
     * @return list<string>
     */
    private static function cuts(string $title, string $album): array
    {
        preg_match_all('/[\(\[\{]([^\)\]\}]*)[\)\]\}]/u', $title, $brackets);
        $dash = preg_match('/\s[-–—]\s(.+)$/u', $title, $match) ? $match[1] : '';
        preg_match_all(self::CUTS, Names::key(implode(' ', [...$brackets[1], $dash])), $found);
        $words = array_values(array_unique($found[0]));
        $live = Str::ascii(trim($title.' '.$album));
        if (preg_match(self::LIVE, $live) === 1 && preg_match('/\b(studio|estudio)\b/i', $live) !== 1) {
            $words[] = 'live';
        }
        $groups = [];
        foreach ($words as $word) {
            $group = collect(self::CUT_GROUPS)->search(fn (array $members) => in_array($word, $members, true));
            $groups[] = $group === false ? $word : $group;
        }

        return array_values(array_unique($groups));
    }

    /** The album name without edition notes, to group the same album across stores. */
    private static function albumKey(string $album): string
    {
        $album = (string) preg_replace('/\s*[\(\[][^\)\]]*(live|en vivo|ao vivo|deluxe|edition|edicion|edición|remaster|expanded|bonus|version|versión)[^\)\]]*[\)\]]/iu', '', $album);
        $album = (string) preg_replace('/\s+-\s+(single|ep)$/iu', '', $album);

        return Names::key($album);
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     * @return array{verdict: string, reasons: list<string>}|null
     */
    private function judge(array $a, array $b): ?array
    {
        if ($a['title'] === '' || $b['title'] === '') {
            return null;
        }
        $shared = array_keys(array_intersect_assoc($a['ids'], $b['ids']));
        $name = self::nameScore($a, $b);
        if ($shared === [] && ($name < self::CLOSE_NAME || $a['numbers'] !== $b['numbers'])) {
            return null;
        }

        $authors = self::authors($a, $b);
        $gap = $a['duration'] !== null && $b['duration'] !== null ? abs($a['duration'] - $b['duration']) : null;
        $cuts = array_values(array_diff([...$a['cuts'], ...$b['cuts']], array_intersect($a['cuts'], $b['cuts'])));
        $album = $a['album'] === '' || $b['album'] === '' ? null : $a['album'] === $b['album'];
        $year = $a['year'] === null || $b['year'] === null ? null : $a['year'] === $b['year'];

        $verdict = match (true) {
            $shared !== [] => $cuts === [] ? self::SAME : self::POSSIBLE,
            $name < self::SAME_NAME => $authors === true && $cuts === [] && $gap !== null && $gap <= self::SAME_LENGTH ? self::POSSIBLE : null,
            $authors === false => $gap !== null && $gap <= 1.0 && $cuts === [] ? self::POSSIBLE : null,
            $cuts !== [] => $gap !== null && $gap <= 1.5 ? self::POSSIBLE : self::VERSION,
            $gap === null => $album === false && $year === false ? self::VERSION : self::SAME,
            $gap <= self::SAME_LENGTH => self::SAME,
            $gap <= self::CLOSE_LENGTH => match (true) {
                $album === true || ($year === true && $album !== false) => self::SAME,
                $album === false && $year === false => self::VERSION,
                default => self::POSSIBLE,
            },
            $gap <= self::OTHER_LENGTH => $album === false || $year === false ? self::VERSION : self::POSSIBLE,
            default => self::VERSION,
        };
        if ($verdict === null) {
            return null;
        }

        return ['verdict' => $verdict, 'reasons' => self::reasons($a, $b, $shared, $name, $authors, $gap, $cuts, $album, $year)];
    }

    /**
     * How alike the names are, also when one of them carries the author: («Rubén Blades Pedro Navaja», «Pedro Navaja»).
     *
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     */
    private static function nameScore(array $a, array $b): float
    {
        $score = self::titleSimilarity($a['title'], $b['title']);
        foreach ([[$a, $b], [$b, $a]] as [$song, $other]) {
            $rest = $other['lead'] !== '' ? self::withoutName($song['title'], $other['lead']) : null;
            if ($rest !== null) {
                $score = max($score, self::titleSimilarity($rest, $other['title']));
            }
        }

        return $score;
    }

    /**
     * How alike two song names are, from 0 to 1. Word order counts («Tú eres» is not «Eres tú») and a
     * name with more words is another song, unless the extra words are a subtitle in brackets.
     */
    private static function titleSimilarity(string $title, string $other): float
    {
        $a = Names::key(Names::cleanTitle($title));
        $b = Names::key(Names::cleanTitle($other));
        if ($a === '' || $b === '') {
            return 0.0;
        }
        if ($a === $b) {
            return 1.0;
        }
        $baseA = Names::baseTitle($title);
        if ($baseA !== '' && $baseA === Names::baseTitle($other)) {
            return 0.95;
        }
        similar_text($a, $b, $percent);
        $edit = strlen($a) <= 255 && strlen($b) <= 255 ? 1 - levenshtein($a, $b) / max(strlen($a), strlen($b)) : 0.0;
        $score = max($percent / 100 * 0.95, $edit);
        $short = strlen($a) < strlen($b) ? $a : $b;
        $long = $short === $a ? $b : $a;
        if (preg_match('/(^| )'.preg_quote($short, '/').'( |$)/', $long) === 1) {
            $score = min($score, 0.72);
        }

        return round($score, 4);
    }

    /**
     * The song name without the author written at its start or end: («Rubén Blades Pedro Navaja», «Rubén Blades») → «Pedro Navaja».
     * Null when the name does not start or end with the author, or nothing would be left.
     */
    private static function withoutName(string $title, string $name): ?string
    {
        $name = Names::key($name);
        if ($name === '' || ! preg_match_all('/[\p{L}\p{N}]+/u', $title, $words, PREG_OFFSET_CAPTURE)) {
            return null;
        }
        foreach ($words[0] as [$word, $at]) {
            $end = $at + strlen($word);
            if (Names::key(substr($title, 0, $end)) === $name) {
                $rest = trim(substr($title, $end), " \t-–—:|·.,");

                return Names::key($rest) !== '' ? $rest : null;
            }
        }
        foreach (array_reverse($words[0]) as [, $at]) {
            if (Names::key(substr($title, $at)) === $name) {
                $rest = trim(substr($title, 0, $at), " \t-–—:|·.,");

                return Names::key($rest) !== '' ? $rest : null;
            }
        }

        return null;
    }

    /**
     * True when they share an author or guest, false when both name theirs and none match, null when one names none.
     *
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     */
    private static function authors(array $a, array $b): ?bool
    {
        if ($a['names'] === [] || $b['names'] === []) {
            return null;
        }
        if (array_intersect($a['names'], $b['names']) !== []) {
            return true;
        }

        return Names::similarity($a['names'][0], $b['names'][0]) >= 0.88;
    }

    /**
     * What the verdict rests on, in the words of the studio.
     *
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     * @param  list<string>  $shared
     * @param  list<string>  $cuts
     * @return list<string>
     */
    private static function reasons(array $a, array $b, array $shared, float $name, ?bool $authors, ?float $gap, array $cuts, ?bool $album, ?bool $year): array
    {
        $reasons = array_map(fn (string $source) => self::IDS[$source], $shared);
        $reasons[] = match (true) {
            $name >= 0.999 => 'mismo nombre',
            $name >= self::SAME_NAME => 'mismo nombre, escrito distinto',
            $name >= self::CLOSE_NAME => 'nombre parecido',
            default => 'otro nombre',
        };
        if ($authors !== null) {
            $reasons[] = $authors ? 'mismo autor' : 'otro autor';
        }
        if ($gap !== null) {
            $reasons[] = match (true) {
                $gap <= 0.5 => 'misma duración ('.self::clock($a['duration']).')',
                $gap <= self::SAME_LENGTH => 'duración casi igual ('.self::clock($a['duration']).' y '.self::clock($b['duration']).')',
                default => 'duración distinta ('.self::clock($a['duration']).' y '.self::clock($b['duration']).')',
            };
        }
        if ($album !== null) {
            $reasons[] = $album ? 'mismo álbum' : 'otro álbum («'.$a['albumName'].'» y «'.$b['albumName'].'»)';
        }
        if ($year !== null) {
            $reasons[] = $year ? 'mismo año ('.$a['year'].')' : 'otro año ('.$a['year'].' y '.$b['year'].')';
        }
        foreach ($cuts as $cut) {
            $reasons[] = 'solo una es '.$cut;
        }

        return $reasons;
    }

    private static function clock(?float $seconds): string
    {
        $seconds = (int) round((float) $seconds);

        return intdiv($seconds, 60).':'.str_pad((string) ($seconds % 60), 2, '0', STR_PAD_LEFT);
    }
}
