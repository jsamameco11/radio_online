<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** What a station is talking about right now, with its hashtags. */
#[Fillable(['station_id', 'title', 'created_by', 'started_at', 'ended_at'])]
class CurrentTopic extends Model
{
    use BelongsToStation;

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public function hashtags(): BelongsToMany
    {
        return $this->belongsToMany(Hashtag::class)
            ->withPivot('position')
            ->orderByPivot('position');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
