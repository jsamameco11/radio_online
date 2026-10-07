<?php

namespace App\Models;

use App\Domain\Stations\Enums\StationRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A user's role in one station team. */
#[Fillable(['station_id', 'user_id', 'role'])]
class StationMember extends Model
{
    protected function casts(): array
    {
        return ['role' => StationRole::class];
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
