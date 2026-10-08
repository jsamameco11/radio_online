<?php

namespace App\Domain\Studio\Catalog\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Catalog\MusicCatalog;
use App\Models\Genre;
use App\Models\Track;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Deletes a genre the current station added: it leaves the station's songs and the artists that
 * carried it. A genre other stations already gave to their songs stays, so their music is untouched.
 */
final class DeleteGenre
{
    public function __construct(
        private readonly MusicCatalog $catalog,
        private readonly CurrentStation $current,
        private readonly AuditTrail $audit,
    ) {}

    /** @return int Songs of the station it was taken from. */
    public function handle(Genre $genre): int
    {
        $songs = $genre->tracks()->count();
        $elsewhere = Track::acrossStations()
            ->whereHas('genres', fn ($query) => $query->whereKey($genre->id))
            ->where('station_id', '!=', $this->current->id())
            ->count();
        if ($elsewhere > 0) {
            throw ValidationException::withMessages(['genre' => $elsewhere === 1
                ? "Otra radio ya usa «{$genre->name}» en 1 canción, así que se queda en el catálogo. Puedes quitarlo de tus canciones."
                : "Otras radios ya usan «{$genre->name}» en {$elsewhere} canciones, así que se queda en el catálogo. Puedes quitarlo de tus canciones.",
            ]);
        }

        DB::transaction(function () use ($genre, $songs) {
            $artists = $genre->artists()->count();
            $genre->delete();
            $this->audit->record('catalog.genre_deleted', null, [
                'genre' => $genre->name,
                'genre_id' => $genre->id,
                'songs' => $songs,
                'artists' => $artists,
            ], station: $this->current->get());
        });
        $this->catalog->forget();

        return $songs;
    }
}
