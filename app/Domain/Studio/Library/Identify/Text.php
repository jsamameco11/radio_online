<?php

namespace App\Domain\Studio\Library\Identify;

use App\Domain\Studio\Catalog\Names;
use Illuminate\Support\Str;

/**
 * How the identification reads song names, credits and albums the way people
 * and stores write them: the cut a name asks for, guests in brackets, social
 * handles, video labels, the author written inside the name and the best
 * spelling of a name credited in several ways.
 */
final class Text
{
    /** Words that mark a recorded-live version. */
    private const LIVE = '/\b(live|en vivo|ao vivo|en directo|directo|desde casa|sesion en vivo|unplugged|mtv unplugged)\b/i';

    /** Bracketed notes that are not part of a song name: credits, versions, video labels. */
    private const NOISE = '/\b(feat|ft|featuring|con|with|live|en vivo|ao vivo|en directo|official|oficial|video|videoclip|audio|lyric|lyrics|letra|visualizer|remaster(ed)?|remasterizado|version|versi[oó]n|edit|radio edit|mono|stereo|explicit|hd|4k|single|sencillo|deluxe|bonus|acoustic|ac[uú]stico|instrumental|pista|karaoke|cover)\b/iu';

    /** Separators between the credited names of a song. */
    private const SPLIT = '/(?:\s*(?:,|;|\/|(?<=\s)(?:&|\+|y|e|x|and|feat\.?|ft\.?|featuring|con|with|vs\.?)(?=\s))\s*)+/iu';

    /** Notes that make another cut of a song: a remix, a sped-up or instrumental version, another language… */
    private const CUTS = '/\b(remix|rmx|mix|reloaded|reimagined|re imagined|rework|redux|revisited|re recorded|rerecorded|re record|new version|nueva version|radio version|sped up|speed up|slowed|reverb|nightcore|8d|instrumental|pista|karaoke|backing track|performance track|playback|acoustic|acustico|unplugged|stripped|piano|demo|extended|edit|club|dub|cover|tribute|made popular|in the style of|spanish|english|portuguese|espanol|ingles|portugues|versao|lofi|lo fi|orchestral|sinfonico|symphonic|a cappella|acapella|session|sessions|medley|popurri|mashup|reprise|interlude|intro|outro|vip|bootleg)\b/';

    /** Endings of a social handle that are not part of the name: @losamigosoficial → «Los Amigos». */
    private const HANDLE_END = '/(oficial|official|org|music|musica|tv|band|banda|channel|vevo|records|online)$/';

    /** A video label in the middle of a name, and whatever follows it: «Vivir Mi Vida Video Oficial En Vivo» → «Vivir Mi Vida». */
    private const LABEL_INSIDE = '/(?<=[\p{L}\p{N}])\s+(?:(?:video|v[ií]deo|videoclip)\s+(?:oficial|official|musical|lyrics?|de\s+letras?|con\s+letras?)|(?:official|oficial)\s+(?:music\s+)?(?:video|v[ií]deo|audio|lyric\s+video)|lyric\s*video|video\s*lyrics?|audio\s+(?:oficial|official)|con\s+letras?|letra\s+oficial)\b.*$/iu';

    /** Video labels written before a name: «VideoLyric La Bicicleta», «Official Video Vivir Mi Vida». */
    public const LABEL_AT_START = '/^\s*(?:(?:video\s*-?\s*lyrics?|lyrics?\s*-?\s*video|videolyrics?|lyricvideo|(?:official|oficial)\s+(?:music\s+)?(?:video|v[ií]deo|audio)|(?:video|v[ií]deo|audio)\s+(?:official|oficial)|estreno|premiere)\b[\s:|·.-]*)+/iu';

    /** Channel labels after an author: «Marc Anthony - Topic», «Juanes - En Vivo», «Shakira Oficial». */
    private const ARTIST_LABEL = '/(?:\s*[\(\[]\s*(?:en vivo|ao vivo|live|oficial|official)\s*[\)\]]|\s*[-–—|:]\s*(?:topic|tema|en vivo|ao vivo|live|oficial|official|canal oficial|official channel|videos?|music|m[uú]sica)|\s+(?:oficial|official|canal oficial|official channel))\s*$/iu';

    /** What the computer adds to a copied or re-downloaded file: «… (1)», «… - copia», «… - Copy (2)». */
    private const COPY_MARK = '/(?:\s*[-–—]\s*(?:copia|copy)(?:\s*\(\d{1,2}\))?|\s*\(\d{1,2}\))\s*$/iu';

    /** Lowercase, without accents or punctuation: «Vivir Mi Vida (En Vivo)» → «vivir mi vida en vivo». */
    public static function key(?string $value): string
    {
        return Names::key(str_replace('+', ' and ', (string) $value));
    }

    /** The song name without credits, version notes, video labels or a track number. */
    public static function cleanTitle(string $title): string
    {
        $title = preg_replace_callback('/\s*[\(\[\{]([^\)\]\}]*)[\)\]\}]/u', fn (array $match) => preg_match(self::NOISE, $match[1]) === 1 ? '' : $match[0], $title) ?? $title;
        $title = preg_replace('/\s+[-–—|]\s+.*\b(live|en vivo|ao vivo|official|oficial|video|audio|lyric|letra|remaster|versi[oó]n|version|ac[uú]stico|acoustic)\b.*$/iu', '', $title) ?? $title;
        $title = preg_replace('/\s+(feat\.?|ft\.?|featuring)\s+.+$/iu', '', $title) ?? $title;
        $title = preg_replace('/(^|\s)@[\w.]+/u', ' ', $title) ?? $title;
        $title = preg_replace(self::LABEL_AT_START, '', $title) ?? $title;
        $title = preg_replace(self::LABEL_INSIDE, '', $title) ?? $title;
        $title = preg_replace('/\s+(?:(?:official|oficial)\s+)?(?:music\s+)?(?:video|videoclip|v[ií]deo|audio|lyric video|lyrics?|letra|visualizer)(?:\s+(?:official|oficial))?\s*$/iu', '', $title) ?? $title;
        $title = preg_replace('/\s+(?:hd|hq|4k|1080p|720p)\s*$/iu', '', $title) ?? $title;
        $title = preg_replace('/^\s*\d{1,3}\s*[-.)_]\s+(?=\S)/u', '', $title) ?? $title;

        return trim(preg_replace('/\s+/u', ' ', $title) ?? $title, " \t\n\r\0\x0B-–—|·.");
    }

    /** The author without channel labels or file-copy marks: «Marc Anthony - Topic», «ShakiraVEVO», «Juanes (1)» → the name. */
    public static function cleanArtist(string $artist): string
    {
        $artist = preg_replace(self::COPY_MARK, '', $artist) ?? $artist;
        $artist = preg_replace(self::ARTIST_LABEL, '', $artist) ?? $artist;
        $artist = preg_replace('/(?<=\p{L})vevo\s*$/iu', '', $artist) ?? $artist;

        return trim(preg_replace('/\s+/u', ' ', $artist) ?? $artist, " \t\n\r\0\x0B-–—|·.,");
    }

    /**
     * Who sang the song first when its name says it is a cover: «Hallelujah (Leonard Cohen - Cover)» → [Leonard Cohen];
     * «(Wonderwall de Oasis - Cover acústico)» → [Wonderwall de Oasis, Oasis]. The names are only guesses until the
     * catalog knows one of them.
     *
     * @return list<string>
     */
    public static function coverOf(string $title): array
    {
        preg_match_all('/[\(\[]([^\)\]]*\bcover\b[^\)\]]*)[\)\]]/iu', $title, $notes);
        $names = [];
        foreach ($notes[1] as $note) {
            if (preg_match('/\bcover\s+(?:de|by|of)\s+(.+)$/iu', $note, $match) === 1) {
                $names[] = $match[1];
            }
            if (preg_match('/^(.+?)\s*[-–—:|]?\s*\bcover\b/iu', trim($note), $match) === 1) {
                $names[] = $match[1];
                if (preg_match('/\s(?:de|by|of)\s+(.+)$/iu', $match[1], $of) === 1) {
                    $names[] = $of[1];
                }
            }
        }

        return self::unique(array_map(fn (string $name) => trim($name, " \t-–—:|·.,"), $names));
    }

    /**
     * Names credited as guests inside a song name: «Vivir Mi Vida (feat. Ana) [Live]» → [Ana].
     *
     * @param  list<string>  $known  Names that contain a separator and must stay whole.
     * @return list<string>
     */
    public static function featuredIn(string $title, array $known = []): array
    {
        $title = self::withoutNoise($title);
        $names = [];
        if (preg_match_all('/[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+([^\)\]]+)[\)\]]/iu', $title, $matches) > 0) {
            foreach ($matches[1] as $credit) {
                $names = [...$names, ...self::splitNames($credit, $known)];
            }
        } elseif (preg_match('/\s(?:feat\.?|ft\.?|featuring)\s+(.+)$/iu', $title, $match) === 1) {
            $names = self::splitNames($match[1], $known);
        }

        return self::unique($names);
    }

    /**
     * Names after «con» or «with» in brackets. They may be people or another song of a medley
     * («Cielito Lindo (Con La Bamba)»), so they only count when something confirms them.
     *
     * @param  list<string>  $known
     * @return list<string>
     */
    public static function mentionedIn(string $title, array $known = []): array
    {
        $names = [];
        if (preg_match_all('/[\(\[]\s*(?:con|with)\s+([^\)\]]+)[\)\]]/iu', self::withoutNoise($title), $matches) > 0) {
            foreach ($matches[1] as $credit) {
                $names = [...$names, ...self::splitNames($credit, $known)];
            }
        }

        return self::unique($names);
    }

    /**
     * The cuts a song name speaks of, in brackets or after a dash: «Despacito (Remix)» → [remix].
     *
     * @return list<string>
     */
    public static function cuts(string $title): array
    {
        preg_match_all('/[\(\[\{]([^\)\]\}]*)[\)\]\}]/u', $title, $brackets);
        $dash = preg_match('/\s[-–—]\s(.+)$/u', $title, $match) === 1 ? $match[1] : '';
        preg_match_all(self::CUTS, self::key(implode(' ', [...$brackets[1], $dash])), $cuts);

        return array_values(array_unique($cuts[0]));
    }

    /** Whether a name is a social handle («@losamigosoficial»). */
    public static function isHandle(string $name): bool
    {
        return str_starts_with(trim($name), '@');
    }

    /** Whether a social handle belongs to a name: «@losamigosoficial» is «Los Amigos». */
    public static function handleOf(string $handle, string $name): bool
    {
        $handle = str_replace(' ', '', self::key($handle));
        $name = str_replace(' ', '', self::key($name));
        if ($handle === '' || strlen($name) < 3) {
            return false;
        }
        if ($handle === $name) {
            return true;
        }
        $rest = substr($handle, strlen($name));

        return str_starts_with($handle, $name) && preg_match(self::HANDLE_END, $rest) === 1 && preg_replace(self::HANDLE_END, '', $rest) === '';
    }

    /**
     * The song name without the author written at its start or end: («Juanes La Camisa Negra», «Juanes») → «La Camisa Negra».
     * Null when the name does not start or end with the author, or nothing would be left.
     */
    public static function withoutName(string $title, string $name): ?string
    {
        $name = self::key($name);
        if ($name === '' || preg_match_all('/[\p{L}\p{N}]+/u', $title, $words, PREG_OFFSET_CAPTURE) === 0) {
            return null;
        }
        foreach ($words[0] as [$word, $at]) {
            $end = $at + strlen($word);
            if (self::key(substr($title, 0, $end)) === $name) {
                $rest = trim(substr($title, $end), " \t-–—:|·.,");

                return self::key($rest) !== '' ? $rest : null;
            }
        }
        foreach (array_reverse($words[0]) as [, $at]) {
            if (self::key(substr($title, $at)) === $name) {
                $rest = trim(substr($title, 0, $at), " \t-–—:|·.,");

                return self::key($rest) !== '' ? $rest : null;
            }
        }

        return null;
    }

    /**
     * Credited names one by one, keeping known names whole even when they contain a separator
     * («Wisin & Yandel», «Earth, Wind & Fire»).
     *
     * @param  list<string>  $known
     * @return list<string>
     */
    public static function splitNames(string $credit, array $known = []): array
    {
        $credit = trim($credit);
        if ($credit === '') {
            return [];
        }
        $kept = [];
        $joined = array_filter($known, fn (string $name) => preg_match(self::SPLIT, ' '.$name.' ') === 1 || str_contains($name, ','));
        usort($joined, fn (string $a, string $b) => mb_strlen($b) <=> mb_strlen($a));
        foreach ($joined as $name) {
            $pattern = '/(?<![\p{L}\p{N}])'.preg_quote($name, '/').'(?![\p{L}\p{N}])/iu';
            if (preg_match($pattern, $credit, $match) === 1) {
                $kept[] = $match[0];
                $credit = preg_replace($pattern, ',', $credit, 1) ?? $credit;
            }
        }
        $parts = preg_split(self::SPLIT, ' '.$credit.' ') ?: [];
        $names = array_map(fn (string $part) => trim($part, " \t\n\r\0\x0B.-–—"), [...$kept, ...$parts]);

        return self::unique(array_values(array_filter($names, fn (string $name) => self::key($name) !== '')));
    }

    /**
     * Names without repeats (by key), in their first spelling and order.
     *
     * @param  iterable<string|null>  $names
     * @return list<string>
     */
    public static function unique(iterable $names): array
    {
        $spaced = [];
        foreach ($names as $name) {
            $spaced[] = preg_replace('/\s+/u', ' ', (string) $name) ?? (string) $name;
        }

        return Names::unique($spaced);
    }

    /** Whether a name speaks of a live recording; a studio version on a live album is not one. */
    public static function isLive(string $value): bool
    {
        $value = Str::ascii($value);

        return preg_match(self::LIVE, $value) === 1 && preg_match('/\b(studio|estudio)\b/i', $value) !== 1;
    }

    /** The album name without edition notes, to group the same album across stores. */
    public static function albumKey(?string $album): string
    {
        $album = (string) $album;
        $album = preg_replace('/\s*[\(\[][^\)\]]*(live|en vivo|ao vivo|deluxe|edition|edicion|edición|remaster|expanded|bonus|version|versión)[^\)\]]*[\)\]]/iu', '', $album) ?? $album;
        $album = preg_replace('/\s+-\s+(single|ep)$/iu', '', $album) ?? $album;

        return self::key($album);
    }

    /** How alike two names are, from 0 to 1, ignoring case, accents and punctuation; a whole name inside the other counts. */
    public static function similarity(?string $a, ?string $b): float
    {
        $a = self::key($a);
        $b = self::key($b);
        if ($a === '' || $b === '') {
            return 0.0;
        }
        if ($a === $b) {
            return 1.0;
        }
        $short = strlen($a) < strlen($b) ? $a : $b;
        $long = $short === $a ? $b : $a;
        $contained = strlen($short) >= 4 && preg_match('/(^| )'.preg_quote($short, '/').'( |$)/', $long) === 1
            ? 0.7 + 0.3 * strlen($short) / strlen($long)
            : 0.0;
        similar_text($a, $b, $percent);
        $tokensA = array_unique(explode(' ', $a));
        $tokensB = array_unique(explode(' ', $b));
        $jaccard = count(array_intersect($tokensA, $tokensB)) / max(1, count(array_unique([...$tokensA, ...$tokensB])));
        $edit = strlen($a) <= 255 && strlen($b) <= 255 ? 1 - levenshtein($a, $b) / max(strlen($a), strlen($b)) : 0.0;

        return round(max($percent / 100 * 0.95, $jaccard * 0.95, $edit, $contained), 4);
    }

    /**
     * How alike two song names are, from 0 to 1. Stricter than similarity(): word order counts
     * («Tú y yo» is not «Yo y tú») and a name with more words is another song («Amor Eterno Mío»),
     * unless the extra words are a subtitle in brackets («Bohemian Rhapsody (Remastered)»).
     */
    public static function titleSimilarity(string $title, string $asked): float
    {
        $a = self::key(self::cleanTitle($title));
        $b = self::key(self::cleanTitle($asked));
        if ($a === '' || $b === '') {
            return 0.0;
        }
        if ($a === $b) {
            return 1.0;
        }
        $baseA = self::key(self::baseTitle($title));
        if ($baseA !== '' && $baseA === self::key(self::baseTitle($asked))) {
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

    /** The song name without anything in brackets: «Gracias a la Vida (Remastered)» → «Gracias a la Vida». */
    public static function baseTitle(string $title): string
    {
        return trim(preg_replace('/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/u', '', self::cleanTitle($title)) ?? $title) ?: self::cleanTitle($title);
    }

    /**
     * The best written of several spellings of the same name: mixed case before «BONITA» or «bonita».
     *
     * @param  list<string|null>  $spellings
     */
    public static function bestSpelling(array $spellings): ?string
    {
        $spellings = array_values(array_filter($spellings, fn (?string $spelling) => is_string($spelling) && trim($spelling) !== ''));
        foreach ($spellings as $spelling) {
            if (mb_strtoupper($spelling) !== $spelling && mb_strtolower($spelling) !== $spelling) {
                return $spelling;
            }
        }

        return $spellings[0] ?? null;
    }

    /**
     * Joins spellings of the same person («Natalia Lafourcade», «Natalia Lafourkade»): the known one,
     * or the most repeated, stays. Two different known names are never joined.
     *
     * @param  list<string>  $names  In order of preference, repeated as often as they were credited.
     * @param  callable(string): bool  $known
     * @return list<string>
     */
    public static function mergeSpellings(array $names, callable $known): array
    {
        $groups = [];
        foreach ($names as $name) {
            foreach ($groups as &$group) {
                $first = $group[0];
                if (self::similarity($first, $name) >= 0.85 && ! ($known($first) && $known($name) && self::key($first) !== self::key($name))) {
                    $group[] = $name;

                    continue 2;
                }
            }
            unset($group);
            $groups[] = [$name];
        }

        return array_map(function (array $group) use ($known) {
            $counts = array_count_values($group);
            arsort($counts);
            foreach (array_keys($counts) as $name) {
                if ($known((string) $name)) {
                    return (string) $name;
                }
            }

            return (string) array_key_first($counts);
        }, $groups);
    }

    /** The song name without bracketed labels that are not credits: «… feat. X (Videoclip Oficial)» → «… feat. X». */
    private static function withoutNoise(string $title): string
    {
        return preg_replace_callback(
            '/\s*[\(\[]([^\)\]]*)[\)\]]/u',
            fn (array $match) => preg_match('/^\s*(feat|ft|featuring|con|with)\b/iu', $match[1]) === 1 || preg_match(self::NOISE, $match[1]) !== 1 ? $match[0] : '',
            $title,
        ) ?? $title;
    }
}
