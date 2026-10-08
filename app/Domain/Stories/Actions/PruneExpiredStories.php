<?php

namespace App\Domain\Stories\Actions;

use App\Domain\Moderation\Enums\ReportStatus;
use App\Domain\Storage\MediaStorage;
use App\Models\Report;
use App\Models\StationStory;
use Illuminate\Database\Eloquent\Collection;

/**
 * Deletes the stories that expired, with their files. A story with an open
 * report stays (listeners no longer see it) until moderation closes the report.
 */
final class PruneExpiredStories
{
    public function __construct(private readonly MediaStorage $storage) {}

    /** Returns how many stories were deleted. */
    public function handle(): int
    {
        $reported = Report::query()
            ->where('reportable_type', (new StationStory)->getMorphClass())
            ->whereIn('status', [ReportStatus::Open->value, ReportStatus::Reviewing->value])
            ->pluck('reportable_id')
            ->all();
        $deleted = 0;

        StationStory::acrossStations()
            ->where('expires_at', '<=', now())
            ->when($reported !== [], fn ($query) => $query->whereNotIn('id', $reported))
            ->chunkById(200, function (Collection $stories) use (&$deleted) {
                StationStory::acrossStations()->whereKey($stories->modelKeys())->delete();
                $stories->each(function (StationStory $story) {
                    $this->storage->delete($story->media_key);
                    $this->storage->delete($story->poster_key);
                });
                $deleted += $stories->count();
            });

        return $deleted;
    }
}
