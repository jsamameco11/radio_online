<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Integrity\Enums\FollowStatus;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** A listener stops following a station; the subscribers go down only if the subscription counted. */
final class UnfollowStation
{
    /** Returns false when the listener did not follow the station. */
    public function handle(User $user, Station $station): bool
    {
        return DB::transaction(function () use ($user, $station) {
            $follow = DB::table('follows')
                ->where('user_id', $user->id)
                ->where('station_id', $station->id)
                ->lockForUpdate()
                ->first(['status']);
            if ($follow === null) {
                return false;
            }

            DB::table('follows')->where('user_id', $user->id)->where('station_id', $station->id)->delete();
            if ($follow->status === FollowStatus::Counted->value) {
                Station::query()->whereKey($station->id)->where('follower_count', '>', 0)->decrement('follower_count');
            }

            return true;
        });
    }
}
