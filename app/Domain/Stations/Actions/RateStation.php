<?php

namespace App\Domain\Stations\Actions;

use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** A signed-in listener rates a station from 1 to 5. A later vote replaces theirs. */
final class RateStation
{
    public function handle(User $user, Station $station, int $stars): void
    {
        DB::transaction(function () use ($user, $station, $stars) {
            Station::query()->whereKey($station->id)->lockForUpdate()->first();

            $station->ratings()->updateOrCreate(
                ['user_id' => $user->id],
                ['stars' => $stars],
            );

            $summary = $station->ratings()->toBase()
                ->selectRaw('count(*) as total, coalesce(avg(stars), 0) as average')
                ->first();

            $station->forceFill([
                'rating_count' => (int) ($summary->total ?? 0),
                'rating_average' => round((float) ($summary->average ?? 0), 2),
            ])->save();
        });
    }
}
