<?php

namespace App\Domain\Studio\Episodes\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Discovery\Hashtags;
use App\Domain\Storage\MediaStorage;
use App\Models\Episode;
use Illuminate\Support\Facades\DB;

/** Deletes an episode and its cover; its audio stays in the library. */
final class DeleteEpisode
{
    public function __construct(
        private readonly MediaStorage $storage,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(Episode $episode): void
    {
        DB::transaction(function () use ($episode) {
            Hashtags::sync($episode->hashtags(), [], 0);
            $episode->delete();
        });
        $this->storage->delete($episode->cover_path);
        $this->audit->record('episode.delete', $episode, ['title' => $episode->title]);
    }
}
