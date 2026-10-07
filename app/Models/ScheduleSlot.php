<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStation;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One block of a station timeline at an exact time (stored in UTC).
 *
 * Layer 0 is the main program: its blocks never overlap and gaps are filled
 * with the automatic music. Overlay layers play on top of it (commercials,
 * effects, jingles), optionally lowering the music while they sound.
 */
#[Fillable(['station_id', 'starts_at', 'duration', 'kind', 'layer', 'track_id', 'playlist_id', 'title', 'note', 'bed', 'shuffle', 'duck', 'volume'])]
class ScheduleSlot extends Model
{
    use BelongsToStation, HasUuids;

    public const LIVE = 'live';

    public const AUTO = 'auto';

    public const MAIN = 0;

    public const OVERLAYS = 3;

    /** Blocks chain one after another, so start times keep their milliseconds. */
    protected $dateFormat = 'Y-m-d H:i:s.v';

    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime',
            'duration' => 'float',
            'layer' => 'integer',
            'bed' => 'boolean',
            'shuffle' => 'boolean',
            'duck' => 'boolean',
            'volume' => 'integer',
        ];
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(Track::class);
    }

    public function playlist(): BelongsTo
    {
        return $this->belongsTo(Playlist::class);
    }

    public function endsAt(): CarbonImmutable
    {
        return $this->starts_at->addMilliseconds((int) round($this->duration * 1000));
    }
}
