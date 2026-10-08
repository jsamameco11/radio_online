<?php

namespace App\Domain\Streaming;

use App\Domain\Integrity\Support\RequestSignals;
use App\Domain\Streaming\Events\ListenerCountChanged;
use App\Models\ListenerSession;
use App\Models\Station;
use App\Models\StreamSession;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Who is listening to each station. Every play opens a listener session (keyed by the token the
 * player draws when it starts) that its heartbeat keeps alive; it ends when the player says
 * goodbye or stops beating for the listener window. The station keeps the current count and its
 * peak, and the open live transmission its own peak.
 *
 * The count resists bot swarms (config('platform.integrity')): a player counts only after it
 * kept playing warmup_seconds, every signed-in account counts once however many players it
 * opens, guests count up to guests_per_network per network, and the players of automated
 * clients, flagged accounts or networks that open sessions non-stop are kept as suspect and
 * never count.
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

    /** Seconds a player keeps playing before it counts. */
    public static function warmup(): int
    {
        return (int) config('platform.integrity.warmup_seconds', 20);
    }

    /** The player of $token is still playing $station. */
    public function heartbeat(Station $station, string $token, ?User $user, ?string $device, ?string $country, RequestSignals $signals): void
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
                    'network' => $signals->network,
                    'suspect' => $this->suspect($station, $user, $signals),
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
                'network' => $session->network ?? $signals->network,
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
        $playing = ListenerSession::query()->toBase()
            ->where('station_id', $station->id)
            ->whereNull('ended_at')
            ->where('last_seen_at', '>=', CarbonImmutable::now()->subSeconds(self::window()))
            ->where('suspect', false)
            ->where('seconds', '>=', self::warmup());
        $perNetwork = (int) config('platform.integrity.guests_per_network', 4);

        $members = (clone $playing)->whereNotNull('user_id')->distinct()->count('user_id');
        $guests = (clone $playing)->whereNull('user_id')
            ->selectRaw('network, count(*) as players')
            ->groupBy('network')
            ->pluck('players')
            ->sum(fn (mixed $players) => min((int) $players, $perNetwork));

        return $members + (int) $guests;
    }

    /** A new player that will never count: automated, of a flagged account or of a network that opens players non-stop. */
    private function suspect(Station $station, ?User $user, RequestSignals $signals): bool
    {
        if ($user?->isFlagged() || $signals->automated) {
            return true;
        }
        $key = "audience:{$station->id}:{$signals->network}";
        if (RateLimiter::tooManyAttempts($key, (int) config('platform.integrity.sessions_per_network', 20))) {
            return true;
        }
        RateLimiter::hit($key, 600);

        return false;
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
