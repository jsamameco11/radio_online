<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A listener's score for a station, from 1 to 5 stars. One row per listener. */
#[Fillable(['station_id', 'user_id', 'stars'])]
class StationRating extends Model
{
    protected function casts(): array
    {
        return ['stars' => 'integer'];
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(Station::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
