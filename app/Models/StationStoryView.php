<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Someone watched a story. "viewer_key" is "u:{id}" for a signed-in user or a
 * hash of the guest's session, so each person counts once per story.
 */
#[Fillable(['story_id', 'viewer_key', 'user_id', 'created_at'])]
class StationStoryView extends Model
{
    public const UPDATED_AT = null;

    public function story(): BelongsTo
    {
        return $this->belongsTo(StationStory::class, 'story_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
