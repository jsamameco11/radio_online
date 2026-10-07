<?php

namespace App\Domain\Chat\Support;

/**
 * The prices a listener can pay to highlight a chat message, from
 * config('platform.chat.highlight_tiers'), cheapest first. Each tier has a
 * level (1 for the cheapest) the chat uses to give it its own look, and how
 * long the message stays pinned at the top of the chat.
 */
final class HighlightTiers
{
    /**
     * @return list<array{cents: int, pin_seconds: int, level: int}>
     */
    public static function all(): array
    {
        $tiers = array_map(fn (array $tier) => [
            'cents' => (int) $tier['cents'],
            'pin_seconds' => (int) $tier['pin_seconds'],
        ], (array) config('platform.chat.highlight_tiers'));

        usort($tiers, fn (array $a, array $b) => $a['cents'] <=> $b['cents']);

        return array_values(array_map(fn (array $tier, int $index) => [...$tier, 'level' => $index + 1], $tiers, array_keys($tiers)));
    }

    /**
     * @return array{cents: int, pin_seconds: int, level: int}|null
     */
    public static function find(int $cents): ?array
    {
        foreach (self::all() as $tier) {
            if ($tier['cents'] === $cents) {
                return $tier;
            }
        }

        return null;
    }

    /** The level of the most expensive tier that $cents reaches (0 when it is not highlighted). */
    public static function levelOf(int $cents): int
    {
        $level = 0;
        foreach (self::all() as $tier) {
            if ($cents >= $tier['cents']) {
                $level = $tier['level'];
            }
        }

        return $level;
    }

    /** @return list<int> */
    public static function prices(): array
    {
        return array_column(self::all(), 'cents');
    }
}
