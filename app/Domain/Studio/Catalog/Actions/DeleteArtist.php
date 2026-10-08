<?php

namespace App\Domain\Studio\Catalog\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Catalog\MusicCatalog;
use App\Models\Artist;
use Illuminate\Support\Facades\DB;

/** Deletes an artist the current station added to the catalog; the songs that credit it stay in the library. */
final class DeleteArtist
{
    public function __construct(
        private readonly MusicCatalog $catalog,
        private readonly CurrentStation $current,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(Artist $artist): void
    {
        DB::transaction(function () use ($artist) {
            $artist->delete();
            $this->audit->record('catalog.artist_deleted', null, [
                'artist' => $artist->name,
                'artist_id' => $artist->id,
                'source' => $artist->source,
            ], station: $this->current->get());
        });
        $this->catalog->forget();
    }
}
