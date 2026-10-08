<?php

namespace App\Models;

use App\Domain\Stories\Enums\StoryBackground;
use App\Domain\Stories\Enums\StoryKind;
use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An "estado": a photo, video or text a station shares for 24 hours. The
 * files live in the stories media folder; the row keeps their keys.
 */
#[Fillable(['station_id', 'posted_by', 'kind', 'media_key', 'poster_key', 'text', 'background', 'duration_ms', 'views_count', 'expires_at'])]
class StationStory extends Model
{
    use BelongsToStation, HasUuids;

    protected $attributes = [
        'views_count' => 0,
    ];

    protected function casts(): array
    {
        return [
            'kind' => StoryKind::class,
            'background' => StoryBackground::class,
            'duration_ms' => 'integer',
            'views_count' => 'integer',
            'expires_at' => 'datetime',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'posted_by');
    }

    public function views(): HasMany
    {
        return $this->hasMany(StationStoryView::class, 'story_id');
    }

    public function scopeActive(Builder $query): void
    {
        $query->where($query->qualifyColumn('expires_at'), '>', now());
    }
}
