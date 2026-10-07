<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One live broadcast of a station: who hosted it, from where, how long and its peak audience. */
#[Fillable(['station_id', 'host_id', 'source', 'title', 'started_at', 'ended_at', 'peak_listeners'])]
class StreamSession extends Model
{
    use BelongsToStation;

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'peak_listeners' => 'integer',
        ];
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_id');
    }
}
