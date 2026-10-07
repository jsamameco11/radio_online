<?php

namespace App\Domain\Streaming;

use App\Domain\Streaming\Events\ListenerCountChanged;
use App\Models\ListenerSession;
use App\Models\Station;
use App\Models\StreamSession;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;

/**
 * Who is listening to each station. Every play opens a listener session (keyed by the token the
 * player draws when it starts) that its heartbeat keeps alive; it ends when the player says
 * goodbye or stops beating for the listener window. The station keeps the current count and its
 * peak, and the open live transmission its own peak.
 */
final class Audience
{
    /** A heartbeat refreshes the session at most this often (seconds). */
    private const TOUCH_EVERY = 10;

    /** The count is taken again at most this often per station (seconds). */
    private const COUNT_EVERY = 5;

    public static function window(): int
    {
        return (int) config('platform.streaming.listener_window', 45);
    }

    /** The player of $token is still playing $station. */
    public function heartbeat(Station $station, string $token, ?User $user, ?string $device, ?string $country): void
    {
        $now = CarbonImmutable::now();
        $session = ListenerSession::query()->where('token', $token)->first();
        if ($session === null) {
            try {
                ListenerSession::query()->create([
                    'station_id' => $station->id,
                    'user_id' => $user?->id,
                    'token' => $token,
                    'device' => $device,
                    'country' => $country,
                    'started_at' => $now,
                    'last_seen_at' => $now,
                ]);
            } catch (QueryException) {
                return;
            }
            $this->refresh($station, force: true);

            return;
        }
        if ($session->station_id !== $station->id || $session->ended_at !== null) {
            return;
        }
        if ($session->last_seen_at->lt($now->subSeconds(self::TOUCH_EVERY))) {
            $session->forceFill([
                'last_seen_at' => $now,
                'seconds' => (int) $session->started_at->diffInSeconds($now, true),
                'user_id' => $session->user_id ?? $user?->id,
            ])->save();
        }
        $this->refresh($station);
    }

    /** The player of $token stopped. */
    public function leave(Station $station, string $token): void
    {
        $session = ListenerSession::query()->where('station_id', $station->id)->where('token', $token)->whereNull('ended_at')->first();
        if ($session === null) {
            return;
        }
        $now = CarbonImmutable::now();
        $session->forceFill(['ended_at' => $now, 'last_seen_at' => $now, 'seconds' => (int) $session->started_at->diffInSeconds($now, true)])->save();
        $this->refresh($station, force: true);
    }

    /** People listening to a station now. */
    public function count(Station $station): int
    {
        return ListenerSession::query()->where('station_id', $station->id)->whereNull('ended_at')
            ->where('last_seen_at', '>=', CarbonImmutable::now()->subSeconds(self::window()))->count();
    }

    /**
     * Ends the sessions whose player stopped beating and updates the count of their stations
     * (and of every station that still shows listeners).
     *
     * @return int sessions ended
     */
    public function sweep(): int
    {
        $cutoff = CarbonImmutable::now()->subSeconds(self::window());
        $stale = ListenerSession::query()->whereNull('ended_at')->where('last_seen_at', '<', $cutoff)->get();
        foreach ($stale as $session) {
            $session->forceFill(['ended_at' => $session->last_seen_at, 'seconds' => (int) $session->started_at->diffInSeconds($session->last_seen_at, true)])->save();
        }
        $ids = $stale->pluck('station_id')->merge(Station::query()->where('listener_count', '>', 0)->pluck('id'))->unique();
        Station::query()->whereIn('id', $ids)->get()->each(fn (Station $station) => $this->refresh($station, force: true));

        return $stale->count();
    }

    /** Stores the count on the station (and the peaks) when it changed, and tells everyone. */
    private function refresh(Station $station, bool $force = false): void
    {
        if (! $force && ! Cache::add("station:{$station->id}:audience.counted", 1, self::COUNT_EVERY)) {
            return;
        }
        $count = $this->count($station);
        $station->refresh();
        if ($count === $station->listener_count) {
            return;
        }
        $station->forceFill([
            'listener_count' => $count,
            'peak_listener_count' => max($station->peak_listener_count, $count),
        ])->save();
        StreamSession::acrossStations()->where('station_id', $station->id)->whereNull('ended_at')
            ->where('peak_listeners', '<', $count)->update(['peak_listeners' => $count]);

        ListenerCountChanged::dispatch($station->id, $count, $station->peak_listener_count);
    }
}
