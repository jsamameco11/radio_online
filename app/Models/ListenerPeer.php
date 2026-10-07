<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** A browser tuned in to a station: presence plus the WebRTC handshake for the live microphone. */
#[Fillable(['id', 'station_id', 'session', 'state', 'offer', 'answer', 'last_seen', 'state_at'])]
class ListenerPeer extends Model
{
    use BelongsToStation, HasUuids;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'last_seen' => 'immutable_datetime',
            'state_at' => 'immutable_datetime',
        ];
    }
}
