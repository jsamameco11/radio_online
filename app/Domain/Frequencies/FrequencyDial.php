<?php

namespace App\Domain\Frequencies;

use Random\Engine\Mt19937;
use Random\Randomizer;

/**
 * The virtual dial of the platform. Channels show the number alone, never a band.
 *
 * Frequencies look like memorable numbers (89.30, 101.70, 95.50…) instead of a
 * consecutive series: every candidate between the band limits gets a weight
 * by how "radio-like" its decimals are (odd tenths first, then even tenths,
 * then .x5 and finally other hundredths) and a seeded weighted draw picks the
 * dial. The draw keeps one fixed key per candidate, so a bigger dial always
 * contains the smaller one: growing from 500 to 1,000 never moves a station.
 */
final class FrequencyDial
{
    /** Weight of each kind of ending, in hundredths of MHz. */
    private const WEIGHTS = [
        'odd_tenth' => 40.0,
        'even_tenth' => 12.0,
        'half' => 4.0,
        'near_half' => 0.6,
        'other' => 0.005,
    ];

    /** What a slug looks like in a route: "89-30", "101-70". */
    public const SLUG_PATTERN = '[0-9]{2,3}-[0-9]{2}';

    public function __construct(
        private readonly float $min,
        private readonly float $max,
        private readonly int $seed,
    ) {}

    public static function fromConfig(): self
    {
        return new self(
            (float) config('platform.dial.min'),
            (float) config('platform.dial.max'),
            (int) config('platform.dial.seed'),
        );
    }

    /**
     * The first $size frequencies of the dial, lowest first, as "89.30" strings.
     *
     * @return list<string>
     */
    public function frequencies(int $size): array
    {
        $keys = $this->keys();
        arsort($keys);
        $chosen = array_map('intval', array_slice(array_keys($keys), 0, $size));
        sort($chosen);

        return array_map(fn (int $hundredths) => self::format($hundredths), $chosen);
    }

    /** "89.30" → "89-30", the public address of the station on that frequency. */
    public static function slug(string $label): string
    {
        return str_replace('.', '-', $label);
    }

    /** "89-30" or "89.3" → "89.30"; null when it is not a frequency. */
    public static function normalize(string $value): ?string
    {
        $value = str_replace([',', '-', ' ', 'fm', 'FM'], ['.', '.', '', '', ''], trim($value));

        if (! preg_match('/^\d{2,3}(\.\d{1,2})?$/', $value)) {
            return null;
        }

        return number_format((float) $value, 2, '.', '');
    }

    private static function format(int $hundredths): string
    {
        return number_format($hundredths / 100, 2, '.', '');
    }

    /**
     * A fixed random key per candidate (Efraimidis–Spirakis weighted sampling):
     * taking the highest keys draws without replacement, proportionally to weight.
     *
     * @return array<int, float>
     */
    private function keys(): array
    {
        $randomizer = new Randomizer(new Mt19937($this->seed));
        $keys = [];

        for ($hundredths = (int) round($this->min * 100); $hundredths <= (int) round($this->max * 100); $hundredths++) {
            $draw = $randomizer->getFloat(PHP_FLOAT_EPSILON, 1.0);
            $keys[$hundredths] = log($draw) / self::WEIGHTS[$this->ending($hundredths)];
        }

        return $keys;
    }

    private function ending(int $hundredths): string
    {
        $hundredth = $hundredths % 10;
        $tenth = intdiv($hundredths, 10) % 10;

        return match (true) {
            $hundredth === 0 && $tenth % 2 === 1 => 'odd_tenth',
            $hundredth === 0 => 'even_tenth',
            $hundredth === 5 => 'half',
            in_array($hundredth, [3, 7], true) => 'near_half',
            default => 'other',
        };
    }
}
