<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One listener tuned in to a station, from play to stop; feeds history and audience stats.
 * Suspect sessions (automated clients, flagged accounts, swarms) never count anywhere.
 */
#[Fillable(['station_id', 'user_id', 'token', 'country', 'device', 'network', 'suspect', 'started_at', 'last_seen_at', 'ended_at', 'seconds'])]
class ListenerSession extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'ended_at' => 'datetime',
            'seconds' => 'integer',
            'suspect' => 'boolean',
        ];
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
