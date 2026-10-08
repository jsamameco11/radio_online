<?php

namespace App\Domain\Stories\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Storage\MediaStorage;
use App\Models\StationStory;

/** The station takes a story down before it expires, files included. */
final class DeleteStory
{
    public function __construct(
        private readonly MediaStorage $storage,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(StationStory $story): void
    {
        $story->delete();
        $this->storage->delete($story->media_key);
        $this->storage->delete($story->poster_key);
        $this->audit->record('stories.deleted', $story, ['kind' => $story->kind->value, 'views' => $story->views_count]);
    }
}
