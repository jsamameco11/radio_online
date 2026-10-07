<?php

namespace App\Domain\Stations\Actions;

use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** A listener follows a station; the station's follower count goes up once. */
final class FollowStation
{
    /** Returns false when the listener already followed the station. */
    public function handle(User $user, Station $station): bool
    {
        return DB::transaction(function () use ($user, $station) {
            $added = DB::table('follows')->insertOrIgnore([
                'user_id' => $user->id,
                'station_id' => $station->id,
                'created_at' => now(),
            ]);

            if ($added > 0) {
                Station::query()->whereKey($station->id)->increment('follower_count');
            }

            return $added > 0;
        });
    }
}
