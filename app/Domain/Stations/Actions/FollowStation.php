<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Integrity\Enums\FollowStatus;
use App\Domain\Integrity\Exceptions\FollowLimitReached;
use App\Domain\Integrity\Subscribers;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

/**
 * A listener follows a station. The subscription counts in the station's subscribers at once
 * when the account already proved to be a real listener; otherwise it waits "en verificación"
 * (see Subscribers). An account can only subscribe to so many stations per hour and per day.
 */
final class FollowStation
{
    public function __construct(private readonly Subscribers $subscribers) {}

    /**
     * Returns false when the listener already followed the station.
     *
     * @throws FollowLimitReached
     */
    public function handle(User $user, Station $station, ?string $network = null): bool
    {
        $limits = [
            "follows:hour:{$user->id}" => [(int) config('platform.integrity.follows_per_hour'), 3600],
            "follows:day:{$user->id}" => [(int) config('platform.integrity.follows_per_day'), 86400],
        ];
        foreach ($limits as $key => [$max]) {
            if (RateLimiter::tooManyAttempts($key, $max)) {
                throw new FollowLimitReached;
            }
        }

        $status = $this->subscribers->statusFor($user);
        $added = DB::transaction(function () use ($user, $station, $network, $status) {
            $added = DB::table('follows')->insertOrIgnore([
                'user_id' => $user->id,
                'station_id' => $station->id,
                'status' => $status->value,
                'network' => $network,
                'counted_at' => $status === FollowStatus::Counted ? now() : null,
                'created_at' => now(),
            ]) > 0;

            if ($added && $status === FollowStatus::Counted) {
                Station::query()->whereKey($station->id)->increment('follower_count');
            }

            return $added;
        });

        if ($added) {
            foreach ($limits as $key => [, $decay]) {
                RateLimiter::hit($key, $decay);
            }
        }

        return $added;
    }
}
