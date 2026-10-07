<?php

namespace App\Domain\Studio\Library\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\Track;
use Illuminate\Support\Facades\DB;

/**
 * Removes an audio from the library and its files from storage. Its blocks
 * on the timeline and its episodes go with it; a recording it came from is
 * kept, without the link.
 */
final class DeleteTrack
{
    public function __construct(
        private readonly MediaStorage $storage,
        private readonly PlayoutCaches $caches,
        private readonly AuditTrail $audit,
        private readonly CurrentStation $current,
    ) {}

    public function handle(Track $track): void
    {
        $files = [$track->file_path, $track->original_path, $track->cover_path];
        $episodes = $track->episodes()->pluck('cover_path')->all();

        DB::transaction(function () use ($track) {
            $track->genres()->detach();
            $track->playlists()->detach();
            $track->delete();
        });

        foreach ([...$files, ...$episodes] as $key) {
            $this->storage->delete($key);
        }
        $this->caches->flush();
        $this->audit->record('library.delete', $this->current->get(), [
            'track' => $track->id,
            'kind' => $track->kind->value,
            'title' => $track->title,
        ]);
    }
}
