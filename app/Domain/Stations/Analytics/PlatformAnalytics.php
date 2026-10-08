<?php

namespace App\Domain\Stations\Analytics;

use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Moderation\Enums\ReportStatus;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\Report;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Platform-wide figures for the control panel: the current state of the dial and daily
 * listening, sign-ups and gift revenue, bucketed in the platform timezone. Each method is a
 * single round trip to the database.
 */
final class PlatformAnalytics
{
    /**
     * Counters of the control panel home. "frequencies" holds the frequencies by status.
     *
     * @return array{stations: int, stations_active: int, stations_suspended: int, on_air: int, live: int, listeners_now: int, users: int, users_this_week: int, pending_requests: int, stale_requests: int, open_reports: int, gifts_today: array{count: int, revenue_cents: int, fee_cents: int}, frequencies: array<string, int>}
     */
    public function overview(): array
    {
        $giftsToday = DB::table('gift_transactions')->where('created_at', '>=', LocalTime::startOfDay());

        $groups = [];
        $groups['kpi'] = [
            'stations' => Station::query()->selectRaw('count(*)'),
            'stations_active' => Station::query()->where('status', StationStatus::Active->value)->selectRaw('count(*)'),
            'stations_suspended' => Station::query()->where('status', StationStatus::Suspended->value)->selectRaw('count(*)'),
            'on_air' => Station::query()->onAir()->selectRaw('count(*)'),
            'live' => Station::query()->where('stream_status', StreamStatus::Live->value)->selectRaw('count(*)'),
            'listeners_now' => Station::query()->onAir()->selectRaw('coalesce(sum(listener_count), 0)'),
            'users' => User::query()->selectRaw('count(*)'),
            'users_this_week' => User::query()->where('created_at', '>=', LocalTime::startOfDay(6))->selectRaw('count(*)'),
            'pending_requests' => FrequencyRequest::query()->where('status', FrequencyRequestStatus::Pending->value)->selectRaw('count(*)'),
            'stale_requests' => FrequencyRequest::query()
                ->where('status', FrequencyRequestStatus::Pending->value)
                ->where('created_at', '<', now()->subHours(48))
                ->selectRaw('count(*)'),
            'open_reports' => Report::query()->whereIn('status', [ReportStatus::Open->value, ReportStatus::Reviewing->value])->selectRaw('count(*)'),
        ];
        $groups['gift'] = [
            'count' => (clone $giftsToday)->selectRaw('count(*)'),
            'revenue_cents' => (clone $giftsToday)->selectRaw('coalesce(sum(total_cents), 0)'),
            'fee_cents' => (clone $giftsToday)->selectRaw('coalesce(sum(platform_fee_cents), 0)'),
        ];
        $groups['frequency'] = [];
        foreach (FrequencyStatus::cases() as $status) {
            $groups['frequency'][$status->value] = Frequency::query()->where('status', $status->value)->selectRaw('count(*)');
        }

        $query = DB::query();
        foreach ($groups as $prefix => $subqueries) {
            foreach ($subqueries as $key => $subquery) {
                $query->selectSub($subquery, "{$prefix}_{$key}");
            }
        }
        $row = (array) $query->first();

        $read = fn (string $prefix): array => array_combine(
            array_keys($groups[$prefix]),
            array_map(fn (string $key) => (int) $row["{$prefix}_{$key}"], array_keys($groups[$prefix])),
        );

        return [...$read('kpi'), 'gifts_today' => $read('gift'), 'frequencies' => $read('frequency')];
    }

    /**
     * @return list<array{day: string, sessions: int, hours: float, signups: int, gifts: int, revenue_cents: int, fee_cents: int}>
     */
    public function daily(int $days = 14): array
    {
        $from = LocalTime::startOfDay($days - 1);

        $rows = DB::table('listener_sessions')
            ->where('started_at', '>=', $from)
            ->where('suspect', false)
            ->selectRaw("'listening' as kind, ".LocalTime::day('started_at').' as day, count(*) as total, coalesce(sum(seconds), 0) as amount, 0 as fee')
            ->groupBy('day')
            ->unionAll(DB::table('users')
                ->where('created_at', '>=', $from)
                ->selectRaw("'signups' as kind, ".LocalTime::day('created_at').' as day, count(*) as total, 0 as amount, 0 as fee')
                ->groupBy('day'))
            ->unionAll(DB::table('gift_transactions')
                ->where('created_at', '>=', $from)
                ->selectRaw("'gifts' as kind, ".LocalTime::day('created_at').' as day, count(*) as total, coalesce(sum(total_cents), 0) as amount, coalesce(sum(platform_fee_cents), 0) as fee')
                ->groupBy('day'))
            ->get()
            ->groupBy('kind')
            ->map(fn ($kind) => $kind->keyBy('day'));

        $listening = $rows['listening'] ?? collect();
        $signups = $rows['signups'] ?? collect();
        $gifts = $rows['gifts'] ?? collect();

        return array_map(fn (string $day) => [
            'day' => $day,
            'sessions' => (int) ($listening[$day]->total ?? 0),
            'hours' => round((int) ($listening[$day]->amount ?? 0) / 3600, 1),
            'signups' => (int) ($signups[$day]->total ?? 0),
            'gifts' => (int) ($gifts[$day]->total ?? 0),
            'revenue_cents' => (int) ($gifts[$day]->amount ?? 0),
            'fee_cents' => (int) ($gifts[$day]->fee ?? 0),
        ], LocalTime::days($from));
    }
}
