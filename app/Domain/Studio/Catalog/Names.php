<?php

namespace App\Domain\Studio\Catalog;

use Illuminate\Support\Str;

/**
 * How song and artist names are compared: «Rubén Blades», «RUBEN BLADES» and
 * «Rubén Blades - Topic» are the same author; «Pedro Navaja (En Vivo)» is
 * the live version of «Pedro Navaja».
 */
final class Names
{
    /** Words that mark a different cut of the same song, by the cut they mark. */
    private const VERSIONS = [
        'live' => '/\b(live|en vivo|ao vivo|en directo|directo|concierto|unplugged|desenchufado)\b/',
        'acoustic' => '/\b(acoustic|acustico|acustica|piano version|version piano|stripped)\b/',
        'remix' => '/\b(remix|rmx|version dance|dance version|bootleg)\b/',
        'instrumental' => '/\b(instrumental|karaoke|pista|backing track)\b/',
        'cover' => '/\b(cover|tribute|tributo)\b/',
    ];

    /** What uploads and videos add to a name that is not part of it. */
    private const NOISE = '/\s*[(\[][^)\]]*\b(official|oficial|video|videoclip|lyrics?|letra|visualizer|audio|hd|hq|4k|remaster(ed)?|remasterizad[oa])\b[^)\]]*[)\]]/iu';

    private const FEATURING = '/\s*[(\[]?\s*\b(feat\.?|ft\.?|featuring|con|with)\s+[^)\]]+[)\]]?\s*$/iu';

    /** «Rubén Blades!» → «ruben blades»: lowercase ASCII words separated by one space. */
    public static function key(?string $text): string
    {
        $ascii = Str::lower(Str::ascii((string) $text));
        $ascii = str_replace('&', ' and ', $ascii);

        return trim((string) preg_replace('/\s+/', ' ', (string) preg_replace('/[^a-z0-9]+/', ' ', $ascii)));
    }

    /** How alike two names are, from 0 to 1. */
    public static function similarity(?string $first, ?string $second): float
    {
        $a = self::key($first);
        $b = self::key($second);
        if ($a === '' || $b === '') {
            return 0.0;
        }
        if ($a === $b || str_replace(' ', '', $a) === str_replace(' ', '', $b)) {
            return 1.0;
        }
        $a = mb_substr($a, 0, 255);
        $b = mb_substr($b, 0, 255);
        $distance = 1 - levenshtein($a, $b) / max(strlen($a), strlen($b));
        $wordsA = explode(' ', $a);
        $wordsB = explode(' ', $b);
        $shared = count(array_intersect($wordsA, $wordsB)) / max(count($wordsA), count($wordsB));

        return round(max($distance, $shared * 0.95), 3);
    }

    /** A song name without video noise, guests or edition notes: «Gracias (feat. X) [Official Video]» → «Gracias». */
    public static function cleanTitle(string $title): string
    {
        $clean = (string) preg_replace(self::NOISE, '', $title);
        $clean = (string) preg_replace(self::FEATURING, '', $clean);
        $clean = (string) preg_replace('/\s+-\s+(\d{4}\s+)?remaster(ed)?.*$/iu', '', $clean);

        return trim((string) preg_replace('/\s+/u', ' ', $clean)) ?: trim($title);
    }

    /** The song itself, without the version notes in brackets or after a dash: «Pedro Navaja - En Vivo» → «pedro navaja». */
    public static function baseTitle(string $title): string
    {
        $clean = self::cleanTitle($title);
        $clean = (string) preg_replace('/\s*[(\[][^)\]]*[)\]]/u', '', $clean);
        $clean = (string) preg_replace('/\s+[-–—]\s+.*$/u', '', $clean);

        return self::key($clean) ?: self::key($title);
    }

    /**
     * The cuts a name asks for: live, acoustic, remix, instrumental or cover.
     *
     * @return list<string>
     */
    public static function versions(?string $text): array
    {
        $key = self::key($text);

        return array_keys(array_filter(self::VERSIONS, fn (string $pattern) => preg_match($pattern, $key) === 1));
    }

    /** An author name as channels and stores write it, without «- Topic», «VEVO» or «Official». */
    public static function cleanArtist(string $name): string
    {
        $clean = (string) preg_replace('/\s*(-\s*topic|vevo|official|oficial)\s*$/iu', '', trim($name));

        return trim((string) preg_replace('/\s+/u', ' ', $clean));
    }

    /**
     * «Rubén Blades, Willie Colón & Héctor Lavoe» → the three names.
     *
     * @param  list<string>  $known  Names that contain a separator and must stay whole («Wisin & Yandel»).
     * @return list<string>
     */
    public static function split(string $credits, array $known = []): array
    {
        $text = ' '.trim($credits).' ';
        $kept = [];
        foreach ($known as $index => $name) {
            $pattern = '/(?<=[\s,;])'.preg_quote($name, '/').'(?=[\s,;])/iu';
            if (preg_match($pattern, $text) === 1) {
                $text = (string) preg_replace($pattern, "\u{1}{$index}\u{1}", $text);
                $kept[$index] = $name;
            }
        }
        $parts = preg_split('/\s*(?:,|;|\/|\s&\s|\s\+\s|\sx\s|\bfeat\.?|\bft\.?|\bfeaturing\b)\s*/iu', trim($text)) ?: [];

        return self::unique(array_map(
            fn (string $part) => (string) preg_replace_callback("/\u{1}(\d+)\u{1}/", fn (array $match) => $kept[(int) $match[1]] ?? '', $part),
            $parts,
        ));
    }

    /**
     * Names without repeats (by key), in their first spelling and order.
     *
     * @param  iterable<string|null>  $names
     * @return list<string>
     */
    public static function unique(iterable $names): array
    {
        $seen = [];
        foreach ($names as $name) {
            $name = trim((string) $name);
            $key = self::key($name);
            if ($key !== '' && ! isset($seen[$key])) {
                $seen[$key] = $name;
            }
        }

        return array_values($seen);
    }
}
