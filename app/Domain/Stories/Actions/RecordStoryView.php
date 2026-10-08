<?php

namespace App\Domain\Stories\Actions;

use App\Models\StationStory;
use App\Models\StationStoryView;
use App\Models\User;

/**
 * Someone watched a story: counted once per viewer, never for whoever posted it.
 * Returns whether this view was new.
 */
final class RecordStoryView
{
    public function handle(StationStory $story, string $viewerKey, ?User $user): bool
    {
        if ($user !== null && $story->posted_by === $user->id) {
            return false;
        }

        $inserted = StationStoryView::query()->insertOrIgnore([
            'story_id' => $story->id,
            'viewer_key' => $viewerKey,
            'user_id' => $user?->id,
            'created_at' => now(),
        ]);
        if ($inserted === 0) {
            return false;
        }
        StationStory::acrossStations()->whereKey($story->id)->increment('views_count');

        return true;
    }
}
