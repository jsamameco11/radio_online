<?php

namespace App\Domain\Stations\Analytics;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Platform-wide daily figures for the control panel: listening, sign-ups
 * and gift revenue, bucketed in the platform timezone.
 */
final class PlatformAnalytics
{
    /**
     * @return list<array{day: string, sessions: int, hours: float, signups: int, gifts: int, revenue_cents: int, fee_cents: int}>
     */
    public function daily(int $days = 14): array
    {
        $from = LocalTime::startOfDay($days - 1);

        $listening = DB::table('listener_sessions')
            ->where('started_at', '>=', $from)
            ->selectRaw(LocalTime::day('started_at').' as day, count(*) as sessions, coalesce(sum(seconds), 0) as seconds')
            ->groupBy('day')
            ->get()
            ->keyBy('day');

        $signups = DB::table('users')
            ->where('created_at', '>=', $from)
            ->selectRaw(LocalTime::day('created_at').' as day, count(*) as signups')
            ->groupBy('day')
            ->pluck('signups', 'day');

        $gifts = DB::table('gift_transactions')
            ->where('created_at', '>=', $from)
            ->selectRaw(LocalTime::day('created_at').' as day, count(*) as gifts, coalesce(sum(total_cents), 0) as revenue, coalesce(sum(platform_fee_cents), 0) as fee')
            ->groupBy('day')
            ->get()
            ->keyBy('day');

        return array_map(fn (string $day) => [
            'day' => $day,
            'sessions' => (int) ($listening[$day]->sessions ?? 0),
            'hours' => round((int) ($listening[$day]->seconds ?? 0) / 3600, 1),
            'signups' => (int) ($signups[$day] ?? 0),
            'gifts' => (int) ($gifts[$day]->gifts ?? 0),
            'revenue_cents' => (int) ($gifts[$day]->revenue ?? 0),
            'fee_cents' => (int) ($gifts[$day]->fee ?? 0),
        ], LocalTime::days($from));
    }

    /**
     * @return array{count: int, revenue_cents: int, fee_cents: int}
     */
    public function giftsSince(CarbonImmutable $from): array
    {
        $row = DB::table('gift_transactions')
            ->where('created_at', '>=', $from)
            ->selectRaw('count(*) as gifts, coalesce(sum(total_cents), 0) as revenue, coalesce(sum(platform_fee_cents), 0) as fee')
            ->first();

        return ['count' => (int) $row->gifts, 'revenue_cents' => (int) $row->revenue, 'fee_cents' => (int) $row->fee];
    }
}
