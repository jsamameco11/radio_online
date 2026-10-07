<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/** A growth milestone a station unlocked ("streak_7", "subscribers_100"…), remembered once. */
#[Fillable(['station_id', 'key', 'achieved_at'])]
class StationAchievement extends Model
{
    use BelongsToStation;

    protected function casts(): array
    {
        return [
            'achieved_at' => 'datetime',
        ];
    }
}
