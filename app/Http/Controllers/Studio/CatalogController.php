<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Studio\Catalog\Actions\AddArtist;
use App\Domain\Studio\Catalog\Actions\AssignGenres;
use App\Domain\Studio\Catalog\ArtistKind;
use App\Domain\Studio\Catalog\GenreFamily;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\CatalogArtistRequest;
use App\Http\Requests\Studio\CatalogAssignRequest;
use App\Models\Artist;
use App\Models\Genre;
use App\Models\Track;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Studio › Catálogo musical: the shared genres and artists, and the genres of the station's songs. */
class CatalogController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('buscar'));
        $genre = (string) $request->query('genero');

        return Inertia::render('Studio/Catalog', [
            'genres' => Genre::query()->withCount('tracks')->orderBy('sort_order')->orderBy('name')->get()
                ->map(fn (Genre $item) => [...$item->brief(), 'songs' => $item->tracks_count]),
            'families' => GenreFamily::options(),
            'artistKinds' => ArtistKind::options(),
            'artists' => Artist::query()
                ->with('genres')
                ->when($search !== '', fn (Builder $query) => $query->where('name', 'like', "%{$search}%"))
                ->when($genre !== '', fn (Builder $query) => $query->whereHas('genres', fn (Builder $match) => $match->whereKey($genre)))
                ->orderBy('name')
                ->paginate(40)
                ->withQueryString()
                ->through(fn (Artist $artist) => [
                    'id' => $artist->id,
                    'name' => $artist->name,
                    'kind' => $artist->kind,
                    'country' => $artist->country,
                    'source' => Artist::SOURCES[$artist->source] ?? $artist->source,
                    'genres' => $artist->genres->map(fn (Genre $item) => $item->brief())->values(),
                ]),
            'songs' => Track::query()->where('kind', TrackKind::Song->value)->with('genres')->orderBy('title')
                ->get(['id', 'title', 'artist', 'featured'])
                ->map(fn (Track $track) => [
                    'id' => $track->id,
                    'title' => $track->title,
                    'credit' => $track->credit(),
                    'genre_ids' => $track->genres->pluck('id')->values(),
                ]),
            'filters' => ['search' => $search, 'genre' => $genre],
            'maxGenres' => Track::MAX_GENRES,
        ]);
    }

    public function storeArtist(CatalogArtistRequest $request, AddArtist $add): RedirectResponse
    {
        $artist = $add->handle($request->validated());

        return back()->with('success', "Agregamos a {$artist->name} al catálogo.");
    }

    public function assign(CatalogAssignRequest $request, AssignGenres $assign, PlayoutCaches $caches): RedirectResponse
    {
        $data = $request->validated();
        $count = $assign->handle($data['track_ids'], $data['genre_ids'], $data['mode']);
        $caches->flush();

        return back()->with('success', $count === 1 ? 'Actualizamos los géneros de 1 canción.' : "Actualizamos los géneros de {$count} canciones.");
    }

    /** Songs without genres take those of their artist. */
    public function classify(AssignGenres $assign, PlayoutCaches $caches): RedirectResponse
    {
        $count = $assign->classify();
        $caches->flush();

        return back()->with('success', match ($count) {
            0 => 'No encontramos canciones sin género cuyo artista conozca el catálogo.',
            1 => 'Clasificamos 1 canción con los géneros de su artista.',
            default => "Clasificamos {$count} canciones con los géneros de sus artistas.",
        });
    }
}
