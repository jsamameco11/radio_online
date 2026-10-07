<?php

namespace App\Domain\Stations\Analytics;

use App\Domain\Storage\MediaStorage;
use App\Models\ListenerSession;
use App\Models\Station;
use App\Models\StreamSession;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Audience figures of one station over a period: listening sessions, hours,
 * peak hours, where and on what people listen, and how the following grows.
 * Days and hours are bucketed in the platform timezone.
 */
final class StationAnalytics
{
    public function __construct(private readonly MediaStorage $storage) {}

    /**
     * @return array<string, int|float>
     */
    public function summary(Station $station, CarbonImmutable $from): array
    {
        $totals = $this->sessions($station, $from)
            ->selectRaw('count(*) as sessions, coalesce(sum(seconds), 0) as seconds, count(distinct user_id) as listeners')
            ->first();

        $sessions = (int) $totals->sessions;
        $seconds = (int) $totals->seconds;

        return [
            'sessions' => $sessions,
            'listeners' => (int) $totals->listeners,
            'hours' => round($seconds / 3600, 1),
            'average_minutes' => $sessions > 0 ? round($seconds / $sessions / 60, 1) : 0,
            'new_followers' => DB::table('follows')->where('station_id', $station->id)->where('created_at', '>=', $from)->count(),
            'peak_listeners' => (int) StreamSession::acrossStations()->where('station_id', $station->id)->where('started_at', '>=', $from)->max('peak_listeners'),
            'listeners_now' => $station->listener_count,
            'followers' => $station->follower_count,
        ];
    }

    /**
     * @return list<array{day: string, sessions: int, hours: float, listeners: int}>
     */
    public function daily(Station $station, CarbonImmutable $from): array
    {
        $rows = $this->sessions($station, $from)
            ->selectRaw(LocalTime::day('started_at').' as day, count(*) as sessions, coalesce(sum(seconds), 0) as seconds, count(distinct user_id) as listeners')
            ->groupBy('day')
            ->get()
            ->keyBy('day');

        return array_map(fn (string $day) => [
            'day' => $day,
            'sessions' => (int) ($rows[$day]->sessions ?? 0),
            'hours' => round((int) ($rows[$day]->seconds ?? 0) / 3600, 1),
            'listeners' => (int) ($rows[$day]->listeners ?? 0),
        ], LocalTime::days($from));
    }

    /**
     * Sessions started per weekday (0 = Sunday) and hour.
     *
     * @return list<list<int>>
     */
    public function heatmap(Station $station, CarbonImmutable $from): array
    {
        $matrix = array_fill(0, 7, array_fill(0, 24, 0));

        $this->sessions($station, $from)
            ->selectRaw(LocalTime::weekday('started_at').' as weekday, '.LocalTime::hour('started_at').' as hour, count(*) as sessions')
            ->groupBy('weekday', 'hour')
            ->get()
            ->each(function (object $row) use (&$matrix) {
                $matrix[(int) $row->weekday][(int) $row->hour] = (int) $row->sessions;
            });

        return $matrix;
    }

    /**
     * @return list<array{code: ?string, sessions: int, hours: float}>
     */
    public function countries(Station $station, CarbonImmutable $from, int $limit = 10): array
    {
        return $this->sessions($station, $from)
            ->selectRaw('country, count(*) as sessions, coalesce(sum(seconds), 0) as seconds')
            ->groupBy('country')
            ->orderByDesc('sessions')
            ->limit($limit)
            ->get()
            ->map(fn (object $row) => ['code' => $row->country, 'sessions' => (int) $row->sessions, 'hours' => round((int) $row->seconds / 3600, 1)])
            ->all();
    }

    /**
     * @return list<array{device: ?string, sessions: int}>
     */
    public function devices(Station $station, CarbonImmutable $from): array
    {
        return $this->sessions($station, $from)
            ->selectRaw('device, count(*) as sessions')
            ->groupBy('device')
            ->orderByDesc('sessions')
            ->get()
            ->map(fn (object $row) => ['device' => $row->device, 'sessions' => (int) $row->sessions])
            ->all();
    }

    /**
     * New followers per day and the running total.
     *
     * @return list<array{day: string, new: int, total: int}>
     */
    public function followerGrowth(Station $station, CarbonImmutable $from): array
    {
        $follows = DB::table('follows')->where('station_id', $station->id);
        $total = (clone $follows)->where('created_at', '<', $from)->count();

        $rows = (clone $follows)
            ->where('created_at', '>=', $from)
            ->selectRaw(LocalTime::day('created_at').' as day, count(*) as follows')
            ->groupBy('day')
            ->pluck('follows', 'day');

        return array_map(function (string $day) use ($rows, &$total) {
            $new = (int) ($rows[$day] ?? 0);
            $total += $new;

            return ['day' => $day, 'new' => $new, 'total' => $total];
        }, LocalTime::days($from));
    }

    /**
     * Followers who listened the most during the period.
     *
     * @return list<array{id: int, name: string, avatar_url: ?string, followed_at: string, hours: float, sessions: int}>
     */
    public function topFollowers(Station $station, CarbonImmutable $from, int $limit = 10): array
    {
        $listening = ListenerSession::query()
            ->toBase()
            ->where('station_id', $station->id)
            ->where('started_at', '>=', $from)
            ->whereNotNull('user_id')
            ->selectRaw('user_id, count(*) as sessions, coalesce(sum(seconds), 0) as seconds')
            ->groupBy('user_id');

        return DB::table('follows')
            ->join('users', 'users.id', '=', 'follows.user_id')
            ->leftJoinSub($listening, 'listening', 'listening.user_id', '=', 'follows.user_id')
            ->where('follows.station_id', $station->id)
            ->select('users.id', 'users.name', 'users.avatar_path', 'follows.created_at as followed_at')
            ->selectRaw('coalesce(listening.seconds, 0) as seconds, coalesce(listening.sessions, 0) as sessions')
            ->orderByRaw('coalesce(listening.seconds, 0) desc')
            ->orderBy('follows.created_at')
            ->limit($limit)
            ->get()
            ->map(fn (object $row) => [
                'id' => (int) $row->id,
                'name' => $row->name,
                'avatar_url' => $this->storage->url($row->avatar_path),
                'followed_at' => CarbonImmutable::parse($row->followed_at)->toIso8601String(),
                'hours' => round((int) $row->seconds / 3600, 1),
                'sessions' => (int) $row->sessions,
            ])
            ->all();
    }

    /**
     * @return list<array{id: int, source: string, title: ?string, host: ?string, started_at: string, ended_at: ?string, peak_listeners: int}>
     */
    public function recentBroadcasts(Station $station, int $limit = 8): array
    {
        return StreamSession::acrossStations()
            ->where('station_id', $station->id)
            ->with('host')
            ->latest('started_at')
            ->limit($limit)
            ->get()
            ->map(fn (StreamSession $session) => [
                'id' => $session->id,
                'source' => $session->source,
                'title' => $session->title,
                'host' => $session->host?->name,
                'started_at' => $session->started_at->toIso8601String(),
                'ended_at' => $session->ended_at?->toIso8601String(),
                'peak_listeners' => $session->peak_listeners,
            ])
            ->all();
    }

    private function sessions(Station $station, CarbonImmutable $from): Builder
    {
        return ListenerSession::query()->toBase()->where('station_id', $station->id)->where('started_at', '>=', $from);
    }
}
