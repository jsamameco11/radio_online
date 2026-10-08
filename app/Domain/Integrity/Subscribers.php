<?php

namespace App\Domain\Integrity;

use App\Domain\Access\Enums\UserStatus;
use App\Domain\Integrity\Enums\FollowStatus;
use App\Models\ListenerSession;
use App\Models\Station;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Which subscriptions count. A subscription counts in the station's subscribers (and so in
 * monetization, the marketplace and the public figure) once its account is in good standing,
 * older than config('platform.integrity.subscriber_account_hours') and has listened at least
 * subscriber_listen_seconds on the platform; until then it waits "en verificación". A farm of
 * fresh accounts that only press the button never reaches the figure.
 */
final class Subscribers
{
    public static function accountHours(): int
    {
        return (int) config('platform.integrity.subscriber_account_hours', 24);
    }

    public static function listenSeconds(): int
    {
        return (int) config('platform.integrity.subscriber_listen_seconds', 120);
    }

    /** How a new subscription of $user starts. */
    public function statusFor(User $user): FollowStatus
    {
        return $this->qualified([$user->id]) === [] ? FollowStatus::Pending : FollowStatus::Counted;
    }

    /**
     * Counts the pending subscriptions of every account that qualifies by now.
     *
     * @return int subscriptions that started to count
     */
    public function promote(): int
    {
        $promoted = 0;
        DB::table('follows')->where('status', FollowStatus::Pending->value)->distinct()->pluck('user_id')
            ->chunk(500)
            ->each(function ($ids) use (&$promoted) {
                $qualified = $this->qualified($ids->map(fn (mixed $id) => (int) $id)->all());
                if ($qualified === []) {
                    return;
                }
                $pending = DB::table('follows')->where('status', FollowStatus::Pending->value)->whereIn('user_id', $qualified);
                $stations = (clone $pending)->distinct()->pluck('station_id')->map(fn (mixed $id) => (int) $id)->all();
                $promoted += $pending->update(['status' => FollowStatus::Counted->value, 'counted_at' => now()]);
                $this->recount($stations);
            });

        return $promoted;
    }

    /**
     * Sets the subscribers of the stations to their counted subscriptions.
     *
     * @param  list<int>  $stationIds
     */
    public function recount(array $stationIds): void
    {
        foreach (array_chunk(array_values(array_unique($stationIds)), 200) as $chunk) {
            Station::query()->withTrashed()->whereIn('id', $chunk)->update([
                'follower_count' => DB::raw("(select count(*) from follows where follows.station_id = stations.id and follows.status = '".FollowStatus::Counted->value."')"),
            ]);
        }
    }

    /** Seconds $user listened on the platform in sessions that count. */
    public function listenedSeconds(int $userId): int
    {
        return (int) ListenerSession::query()->where('user_id', $userId)->where('suspect', false)->sum('seconds');
    }

    /**
     * The accounts among $userIds whose subscriptions count.
     *
     * @param  list<int>  $userIds
     * @return list<int>
     */
    public function qualified(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }
        $standing = User::query()->toBase()
            ->whereIn('id', $userIds)
            ->whereNull('flagged_at')
            ->where('status', UserStatus::Active->value)
            ->whereNotNull('email_verified_at')
            ->where('created_at', '<=', CarbonImmutable::now()->subHours(self::accountHours()))
            ->pluck('id')
            ->map(fn (mixed $id) => (int) $id)
            ->all();
        if ($standing === [] || self::listenSeconds() <= 0) {
            return $standing;
        }

        return ListenerSession::query()->toBase()
            ->whereIn('user_id', $standing)
            ->where('suspect', false)
            ->groupBy('user_id')
            ->havingRaw('sum(seconds) >= ?', [self::listenSeconds()])
            ->pluck('user_id')
            ->map(fn (mixed $id) => (int) $id)
            ->values()
            ->all();
    }
}
