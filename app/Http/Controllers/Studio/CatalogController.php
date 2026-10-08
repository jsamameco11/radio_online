<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Catalog\Actions\AssignGenres;
use App\Domain\Studio\Catalog\Actions\DeleteArtist;
use App\Domain\Studio\Catalog\Actions\DeleteGenre;
use App\Domain\Studio\Catalog\Actions\SaveArtist;
use App\Domain\Studio\Catalog\Actions\SaveGenre;
use App\Domain\Studio\Catalog\ArtistKind;
use App\Domain\Studio\Catalog\GenreFamily;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\Identify\Text;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\CatalogArtistRequest;
use App\Http\Requests\Studio\CatalogAssignRequest;
use App\Http\Requests\Studio\CatalogGenreRequest;
use App\Models\Artist;
use App\Models\Genre;
use App\Models\Track;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Studio › Catálogo musical: the shared genres (styles) and artists that classify every song, the
 * ones the station added and may change, and the genres of the station's songs.
 */
class CatalogController extends Controller
{
    /** Filter of the artists a station added or learned. */
    private const OWN = 'station';

    public function index(Request $request, CurrentStation $current): Response
    {
        $search = trim((string) $request->query('buscar'));
        $genre = (string) $request->query('genero');
        $kind = (string) $request->query('tipo');
        $source = (string) $request->query('origen');
        $stationId = $current->id();

        $songs = Track::query()->where('kind', TrackKind::Song->value)->with('genres')->orderBy('title')->get(['id', 'title', 'artist', 'featured']);
        $songsBy = [];
        foreach ($songs as $song) {
            foreach (array_unique(array_map(fn (string $name) => Text::key($name), array_filter([$song->artist, ...($song->featured ?? [])]))) as $key) {
                $songsBy[$key] = ($songsBy[$key] ?? 0) + 1;
            }
        }

        $genres = Genre::query()->withCount(['tracks', 'artists'])->orderBy('sort_order')->orderBy('name')->get();

        return Inertia::render('Studio/Catalog', [
            'genres' => $genres->map(fn (Genre $item) => [
                ...$item->brief(),
                'aliases' => $item->aliases ?? [],
                'custom' => $item->custom,
                'editable' => $item->ownedBy($stationId),
                'songs' => $item->tracks_count,
                'artists' => $item->artists_count,
            ]),
            'families' => GenreFamily::options(),
            'artistKinds' => ArtistKind::options(),
            'artistSources' => [
                ...collect(Artist::SOURCES)->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])->values(),
                ['value' => self::OWN, 'label' => 'Agregados por tu radio'],
            ],
            'artists' => Artist::query()
                ->with('genres')
                ->when($search !== '', fn (Builder $query) => $this->search($query, $search))
                ->when($genre !== '', fn (Builder $query) => $query->whereHas('genres', fn (Builder $match) => $match->whereKey($genre)))
                ->when(ArtistKind::tryFrom($kind), fn (Builder $query, ArtistKind $value) => $query->where('kind', $value->value))
                ->when($source === self::OWN, fn (Builder $query) => $query->where('station_id', $stationId))
                ->when(isset(Artist::SOURCES[$source]), fn (Builder $query) => $query->where('source', $source))
                ->orderBy('name')
                ->paginate(40)
                ->withQueryString()
                ->through(fn (Artist $artist) => [
                    'id' => $artist->id,
                    'name' => $artist->name,
                    'aliases' => $artist->aliases ?? [],
                    'kind' => $artist->kind,
                    'country' => $artist->country,
                    'source' => $artist->source,
                    'editable' => $artist->ownedBy($stationId),
                    'songs' => max(array_map(fn (string $name) => $songsBy[Text::key($name)] ?? 0, $artist->names())),
                    'genres' => $artist->genres->map(fn (Genre $item) => $item->brief())->values(),
                ]),
            'stats' => [
                'genres' => $genres->count(),
                'custom' => $genres->where('custom', true)->count(),
                'own_genres' => $genres->filter(fn (Genre $item) => $item->ownedBy($stationId))->count(),
                'in_use' => $genres->where('tracks_count', '>', 0)->count(),
                'artists' => Artist::query()->count(),
                'learned' => Artist::query()->where('source', Artist::LEARNED)->count(),
                'own_artists' => Artist::query()->where('station_id', $stationId)->count(),
            ],
            'songs' => $songs->map(fn (Track $track) => [
                'id' => $track->id,
                'title' => $track->title,
                'credit' => $track->credit(),
                'genre_ids' => $track->genres->pluck('id')->values(),
            ]),
            'filters' => ['search' => $search, 'genre' => $genre, 'kind' => $kind, 'source' => $source],
            'maxGenres' => Track::MAX_GENRES,
        ]);
    }

    public function storeGenre(CatalogGenreRequest $request, SaveGenre $save): RedirectResponse
    {
        $genre = $save->handle($request->validated());

        return back()->with('success', "Agregamos el estilo {$genre->name}. Ya puedes elegirlo en tus canciones.");
    }

    public function updateGenre(CatalogGenreRequest $request, SaveGenre $save, string $genre): RedirectResponse
    {
        $model = Genre::query()->findOrFail($genre);
        Gate::authorize('update', $model);
        $save->handle($request->validated(), $model);

        return back()->with('success', 'Estilo actualizado.');
    }

    public function destroyGenre(DeleteGenre $delete, PlayoutCaches $caches, string $genre): RedirectResponse
    {
        $model = Genre::query()->findOrFail($genre);
        Gate::authorize('delete', $model);
        $songs = $delete->handle($model);
        $caches->flush();

        return back()->with('success', match ($songs) {
            0 => "Eliminamos el estilo {$model->name}.",
            1 => "Eliminamos el estilo {$model->name} y lo quitamos de 1 canción.",
            default => "Eliminamos el estilo {$model->name} y lo quitamos de {$songs} canciones.",
        });
    }

    public function storeArtist(CatalogArtistRequest $request, SaveArtist $save): RedirectResponse
    {
        $artist = $save->handle($request->validated());

        return back()->with('success', "Agregamos a {$artist->name} al catálogo. Sus canciones se clasificarán con sus géneros.");
    }

    public function updateArtist(CatalogArtistRequest $request, SaveArtist $save, string $artist): RedirectResponse
    {
        $model = Artist::query()->findOrFail($artist);
        Gate::authorize('update', $model);
        $save->handle($request->validated(), $model);

        return back()->with('success', 'Artista actualizado.');
    }

    public function destroyArtist(DeleteArtist $delete, string $artist): RedirectResponse
    {
        $model = Artist::query()->findOrFail($artist);
        Gate::authorize('delete', $model);
        $delete->handle($model);

        return back()->with('success', "Quitamos a {$model->name} del catálogo. Sus canciones siguen en la biblioteca.");
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

    /** Artists whose name, other spellings, country or genres contain the words searched, with or without accents. */
    private function search(Builder $query, string $search): void
    {
        $lower = '%'.mb_strtolower($search).'%';
        $plain = Str::slug($search) !== '' ? '%'.Str::slug($search).'%' : $lower;
        $query->where(fn (Builder $match) => $match
            ->whereRaw('lower(name) like ?', [$lower])
            ->orWhere('slug', 'like', $plain)
            ->orWhereRaw('lower(cast(aliases as text)) like ?', [$lower])
            ->when(preg_match('/^[a-z]{2}$/i', $search) === 1, fn (Builder $country) => $country->orWhere('country', strtoupper($search)))
            ->orWhereHas('genres', fn (Builder $genre) => $genre->whereRaw('lower(name) like ?', [$lower])->orWhere('slug', 'like', $plain)));
    }
}
