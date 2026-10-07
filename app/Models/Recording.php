<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A live transmission captured from the console, until it becomes a library audio or is discarded. */
#[Fillable(['station_id', 'user_id', 'session', 'status', 'path', 'extension', 'mime', 'bytes', 'parts', 'duration', 'started_at', 'finished_at', 'track_id'])]
class Recording extends Model
{
    use BelongsToStation, HasUuids;

    protected function casts(): array
    {
        return [
            'bytes' => 'integer',
            'parts' => 'integer',
            'duration' => 'float',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(Track::class);
    }
}
