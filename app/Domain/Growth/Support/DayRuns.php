<?php

namespace App\Domain\Growth\Support;

use Carbon\CarbonImmutable;

/** Runs of consecutive calendar days ("2026-10-05", "2026-10-06"…) inside a set of days. */
final class DayRuns
{
    /**
     * @param  iterable<string>  $days
     * @return list<list<string>> oldest run first
     */
    public static function of(iterable $days): array
    {
        $runs = [];
        $run = [];

        foreach (collect($days)->unique()->sort()->values() as $day) {
            if ($run !== [] && CarbonImmutable::parse($run[array_key_last($run)])->addDay()->toDateString() !== $day) {
                $runs[] = $run;
                $run = [];
            }
            $run[] = $day;
        }

        if ($run !== []) {
            $runs[] = $run;
        }

        return $runs;
    }

    /**
     * The longest run; on a tie, the most recent one.
     *
     * @param  iterable<string>  $days
     * @return list<string>
     */
    public static function longest(iterable $days): array
    {
        $longest = [];

        foreach (self::of($days) as $run) {
            if (count($run) >= count($longest)) {
                $longest = $run;
            }
        }

        return $longest;
    }

    /**
     * The run still alive on $today: the one that includes today or, since
     * today is not over yet, the one that ended yesterday.
     *
     * @param  iterable<string>  $days
     * @return list<string>
     */
    public static function alive(iterable $days, string $today): array
    {
        $yesterday = CarbonImmutable::parse($today)->subDay()->toDateString();

        foreach (array_reverse(self::of($days)) as $run) {
            $last = $run[array_key_last($run)];

            if ($last === $today || $last === $yesterday) {
                return $run;
            }
            if ($last < $yesterday) {
                break;
            }
        }

        return [];
    }
}
