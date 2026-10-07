<?php

namespace App\Domain\Studio\Broadcast;

use Carbon\CarbonImmutable;
use Throwable;

/**
 * Time of the broadcast engine: every moment travels as UTC milliseconds and
 * calendar days are those of the platform timezone (Lima, no daylight saving).
 */
final class BroadcastClock
{
    public static function timezone(): string
    {
        return (string) config('platform.timezone', 'America/Lima');
    }

    public static function nowMs(): int
    {
        return CarbonImmutable::now()->getTimestampMs();
    }

    public static function utc(int $ms): CarbonImmutable
    {
        return CarbonImmutable::createFromTimestampMs($ms, 'UTC');
    }

    public static function today(): string
    {
        return CarbonImmutable::now(self::timezone())->toDateString();
    }

    /**
     * UTC milliseconds of 00:00 and 24:00 of a calendar day.
     *
     * @return array{0: int, 1: int}
     */
    public static function dayBounds(string $date): array
    {
        $start = CarbonImmutable::parse($date, self::timezone())->startOfDay();

        return [$start->getTimestampMs(), $start->addDay()->getTimestampMs()];
    }

    /** A valid Y-m-d calendar date, or null. */
    public static function date(mixed $value): ?string
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }

        try {
            return CarbonImmutable::createFromFormat('!Y-m-d', $value, self::timezone())->toDateString() === $value ? $value : null;
        } catch (Throwable) {
            return null;
        }
    }

    /** UTC milliseconds of a local time (HH:MM or HH:MM:SS) on a day, or null. */
    public static function at(string $date, string $time): ?int
    {
        if (! preg_match('/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/', trim($time), $match)) {
            return null;
        }

        return CarbonImmutable::parse($date, self::timezone())->startOfDay()
            ->setTime((int) $match[1], (int) $match[2], (int) ($match[3] ?? 0))
            ->getTimestampMs();
    }

    /** "18:30:15" in the platform timezone. */
    public static function clock(int $ms): string
    {
        return CarbonImmutable::createFromTimestampMs($ms)->setTimezone(self::timezone())->format('H:i:s');
    }

    public static function localDay(int $ms): string
    {
        return CarbonImmutable::createFromTimestampMs($ms)->setTimezone(self::timezone())->toDateString();
    }
}
