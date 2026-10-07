<?php

namespace App\Domain\Stations\Actions;

use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** A listener stops following a station. */
final class UnfollowStation
{
    /** Returns false when the listener did not follow the station. */
    public function handle(User $user, Station $station): bool
    {
        return DB::transaction(function () use ($user, $station) {
            $removed = DB::table('follows')
                ->where('user_id', $user->id)
                ->where('station_id', $station->id)
                ->delete();

            if ($removed > 0) {
                Station::query()->whereKey($station->id)->where('follower_count', '>', 0)->decrement('follower_count');
            }

            return $removed > 0;
        });
    }
}
