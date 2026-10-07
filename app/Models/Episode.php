<?php

namespace App\Models;

use App\Domain\Studio\Enums\EpisodeStatus;
use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A recorded program listeners can play on demand. The audio lives in the
 * station library: deleting it there removes the episode too.
 */
#[Fillable(['station_id', 'track_id', 'title', 'program', 'description', 'cover_path', 'season', 'number', 'status', 'aired_on', 'publish_at', 'published_at'])]
class Episode extends Model
{
    use BelongsToStation, HasUuids;

    protected function casts(): array
    {
        return [
            'status' => EpisodeStatus::class,
            'aired_on' => 'date',
            'publish_at' => 'datetime',
            'published_at' => 'datetime',
            'season' => 'integer',
            'number' => 'integer',
        ];
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(Track::class);
    }

    public function hashtags(): BelongsToMany
    {
        return $this->belongsToMany(Hashtag::class)
            ->withPivot('position')
            ->orderByPivot('position');
    }

    public function scopePublished(Builder $query): void
    {
        $query->where('status', EpisodeStatus::Published->value)
            ->whereHas('track', fn (Builder $track) => $track->where('active', true));
    }
}
