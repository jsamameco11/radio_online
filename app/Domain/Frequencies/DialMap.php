<?php

namespace App\Domain\Frequencies;

use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Models\Frequency;

/** How the dial is used: frequencies per status and the band split in equal ranges, from one grouped query. */
final class DialMap
{
    public const SEGMENTS = 40;

    /**
     * @return array{
     *     totals: array<string, int>,
     *     segments: list<array{from: float, to: float, total: int, used: int, on_air: int}>
     * }
     */
    public function handle(): array
    {
        $min = (float) config('platform.dial.min');
        $max = (float) config('platform.dial.max');
        $width = ($max - $min) / self::SEGMENTS;

        $totals = array_fill_keys(array_map(fn (FrequencyStatus $status) => $status->value, FrequencyStatus::cases()), 0);
        $segments = array_map(fn (int $index) => [
            'from' => round($min + $index * $width, 2),
            'to' => round($index === self::SEGMENTS - 1 ? $max : $min + ($index + 1) * $width, 2),
            'total' => 0,
            'used' => 0,
            'on_air' => 0,
        ], range(0, self::SEGMENTS - 1));

        // Whole hundredths of MHz and integer division: the same segment on PostgreSQL and SQLite.
        $minCents = (int) round($min * 100);
        $spanCents = (int) round($max * 100) - $minCents;
        $segment = sprintf('(cast(round(frequency * 100) as integer) - %d) * %d / %d', $minCents, self::SEGMENTS, $spanCents);

        $groups = Frequency::query()->toBase()
            ->selectRaw("{$segment} as segment, status, count(*) as total")
            ->groupByRaw("{$segment}, status")
            ->get();

        foreach ($groups as $group) {
            $count = (int) $group->total;
            $index = min(self::SEGMENTS - 1, max(0, (int) $group->segment));

            $totals[$group->status] = ($totals[$group->status] ?? 0) + $count;
            $segments[$index]['total'] += $count;
            $segments[$index]['used'] += $group->status === FrequencyStatus::Available->value ? 0 : $count;
            $segments[$index]['on_air'] += $group->status === FrequencyStatus::Active->value ? $count : 0;
        }

        return ['totals' => $totals, 'segments' => $segments];
    }
}
