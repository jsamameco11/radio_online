<?php

namespace App\Domain\Stations\Analytics;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * SQL expressions that bucket a UTC timestamp column in the platform
 * timezone (day, hour, weekday), for SQLite, PostgreSQL and MySQL. Column
 * names are always constants of the caller, never user input.
 */
final class LocalTime
{
    public static function timezone(): string
    {
        return (string) config('platform.timezone');
    }

    /** First instant of the local day $daysAgo days before today, in UTC. */
    public static function startOfDay(int $daysAgo = 0): CarbonImmutable
    {
        return CarbonImmutable::now(self::timezone())->subDays($daysAgo)->startOfDay()->utc();
    }

    /** "2026-10-07" */
    public static function day(string $column): string
    {
        $local = self::shifted($column);

        return match (DB::getDriverName()) {
            'sqlite' => "strftime('%Y-%m-%d', {$local})",
            'pgsql' => "to_char({$local}, 'YYYY-MM-DD')",
            default => "DATE_FORMAT({$local}, '%Y-%m-%d')",
        };
    }

    /** 0–23 */
    public static function hour(string $column): string
    {
        $local = self::shifted($column);

        return match (DB::getDriverName()) {
            'sqlite' => "CAST(strftime('%H', {$local}) AS INTEGER)",
            'pgsql' => "CAST(EXTRACT(HOUR FROM {$local}) AS INTEGER)",
            default => "HOUR({$local})",
        };
    }

    /** 0 = Sunday … 6 = Saturday */
    public static function weekday(string $column): string
    {
        $local = self::shifted($column);

        return match (DB::getDriverName()) {
            'sqlite' => "CAST(strftime('%w', {$local}) AS INTEGER)",
            'pgsql' => "CAST(EXTRACT(DOW FROM {$local}) AS INTEGER)",
            default => "(DAYOFWEEK({$local}) - 1)",
        };
    }

    /**
     * Every local day from $from to today, oldest first: ["2026-10-01", …].
     *
     * @return list<string>
     */
    public static function days(CarbonImmutable $from): array
    {
        $day = $from->setTimezone(self::timezone())->startOfDay();
        $today = CarbonImmutable::now(self::timezone())->startOfDay();
        $days = [];

        while ($day->lte($today)) {
            $days[] = $day->toDateString();
            $day = $day->addDay();
        }

        return $days;
    }

    private static function shifted(string $column): string
    {
        $minutes = CarbonImmutable::now(self::timezone())->utcOffset();

        return match (DB::getDriverName()) {
            'sqlite' => "datetime({$column}, '".($minutes >= 0 ? '+' : '').$minutes." minutes')",
            'pgsql' => "({$column} + interval '{$minutes} minutes')",
            default => "DATE_ADD({$column}, INTERVAL {$minutes} MINUTE)",
        };
    }
}
