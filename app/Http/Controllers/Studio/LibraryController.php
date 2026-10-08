<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Catalog\GenreFamily;
use App\Domain\Studio\Catalog\Names;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Episodes\Actions\SaveEpisode;
use App\Domain\Studio\Library\Actions\DeleteTrack;
use App\Domain\Studio\Library\Actions\SaveTrack;
use App\Domain\Studio\Library\AudioFile;
use App\Domain\Studio\Library\AudioUploads;
use App\Domain\Studio\Library\Duplicates;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Domain\Studio\Library\SameSong;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\LibraryTrackRequest;
use App\Http\Resources\LibraryTrackResource;
use App\Models\Genre;
use App\Models\Track;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/** Studio › Biblioteca: every audio of the station, by kind, author or style, with uploads, identification and file checks. */
class LibraryController extends Controller
{
    public function index(Request $request, AudioUploads $uploads): Response
    {
        $kind = TrackKind::tryFrom((string) $request->query('tipo'));
        $search = trim((string) $request->query('buscar'));
        $style = Str::isUuid((string) $request->query('estilo')) ? (string) $request->query('estilo') : null;
        $problems = $request->boolean('revision');

        $tracks = Track::query()
            ->with('genres')
            ->withCount(LibraryTrackResource::counts())
            ->when(! $problems && $kind, fn (Builder $query) => $query->where('kind', $kind->value))
            ->when($problems, fn (Builder $query) => $query->whereNotNull('file_problem'))
            ->when($style, fn (Builder $query) => $query->whereHas('genres', fn (Builder $genres) => $genres->whereKey($style)))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $match) => $match
                ->where('title', 'like', "%{$search}%")
                ->orWhere('artist', 'like', "%{$search}%")
                ->orWhere('featured', 'like', "%{$search}%")
                ->orWhere('album', 'like', "%{$search}%")
                ->orWhereHas('genres', fn (Builder $genres) => $genres->where('name', 'like', "%{$search}%"))))
            ->when($request->boolean('rotacion'), fn (Builder $query) => $query->where('rotation', true))
            ->latest()
            ->paginate(30)
            ->withQueryString()
            ->through(fn (Track $track) => LibraryTrackResource::make($track)->resolve($request));

        $counts = Track::query()->selectRaw('kind, count(*) as total')->groupBy('kind')->pluck('total', 'kind');
        $count = fn (TrackKind ...$kinds) => (int) collect($kinds)->sum(fn (TrackKind $case) => $counts[$case->value] ?? 0);
        $rotation = Track::query()->where('kind', TrackKind::Song)->where('rotation', true)->where('active', true)
            ->selectRaw('count(*) as total, coalesce(sum(duration), 0) as seconds')->first();
        $styles = Genre::query()->whereHas('tracks', fn (Builder $songs) => $songs->where('kind', TrackKind::Song))
            ->orderBy('name')->get()->map(fn (Genre $genre) => $genre->brief())->values();

        return Inertia::render('Studio/Library', [
            'tracks' => $tracks,
            'filters' => [
                'kind' => $problems ? null : $kind?->value,
                'search' => $search,
                'style' => $style,
                'problems' => $problems,
                'rotation' => $request->boolean('rotacion'),
            ],
            'kinds' => collect(TrackKind::cases())->map(fn (TrackKind $case) => [
                'value' => $case->value,
                'label' => $case->label(),
                'count' => $count($case),
            ])->values(),
            'stats' => [
                'total' => $count(...TrackKind::cases()),
                'songs' => $count(TrackKind::Song),
                'rotation' => (int) ($rotation->total ?? 0),
                'rotation_seconds' => (float) ($rotation->seconds ?? 0),
                'spots' => $count(TrackKind::Commercial, TrackKind::Jingle, TrackKind::Effect),
                'programs' => $count(TrackKind::Program),
                'authors' => $this->authors(),
            ],
            'problems' => Track::query()->whereNotNull('file_problem')->count(),
            'styles' => $styles,
            'songs' => Inertia::optional(fn () => Track::query()
                ->with('genres')
                ->withCount(LibraryTrackResource::counts())
                ->where('kind', TrackKind::Song)
                ->orderBy('title')
                ->get()
                ->map(fn (Track $track) => LibraryTrackResource::make($track)->resolve($request))
                ->values()),
            'genres' => Genre::query()->orderBy('sort_order')->orderBy('name')->get()->map(fn (Genre $genre) => $genre->brief())->values(),
            'families' => GenreFamily::options(),
            'limits' => [
                'direct' => $uploads->direct(),
                'max_mb' => $uploads->maxMegabytes(),
                'max_cover_mb' => (int) config('platform.media.max_cover_mb'),
                'max_duration' => AudioFile::maxDuration(),
                'max_featured' => Track::MAX_FEATURED,
                'max_genres' => Track::MAX_GENRES,
                'max_description' => LibraryTrackRequest::MAX_EPISODE_DESCRIPTION,
                'types' => AudioFile::TYPES,
            ],
        ]);
    }

    public function store(LibraryTrackRequest $request, SaveTrack $save, SaveEpisode $episodes, Duplicates $duplicates, CurrentStation $current): JsonResponse
    {
        $data = $request->validated();
        $kind = TrackKind::from($data['kind']);
        $episode = $request->boolean('episode');
        abort_if($episode && ! $request->user()->canInStation($current->get(), StationPermission::ManageEpisodes), 403, 'No puedes publicar episodios en esta radio.');

        if ($kind === TrackKind::Song && ! $request->boolean('duplicate_ok')) {
            $twin = $duplicates->twin([...$data, 'ids' => $data['identity']['ids'] ?? []]);
            if ($twin !== null) {
                return response()->json([
                    'message' => "Esta canción ya está en la biblioteca: «{$twin->title}»".($twin->credit() ? " de {$twin->credit()}" : '').'. Elige en su tarjeta qué hacer: no subirla, reemplazar la que ya está o guardar ambas.',
                    'duplicates' => [[...$duplicates->brief($twin), 'verdict' => SameSong::SAME]],
                ], 409);
            }
        }

        $track = $save->handle($request->user(), $data, $request->file('audio'), $request->file('cover'));
        if ($episode) {
            $episodes->handle($request->user(), [
                'title' => $track->title,
                'program' => $track->artist,
                'description' => $data['episode_description'] ?? null,
                'status' => EpisodeStatus::Published->value,
                'source' => SaveEpisode::LIBRARY,
                'track_id' => $track->id,
            ], null, $request->file('episode_cover'));
        }

        return response()->json(['track' => $this->present($track, $request)], 201);
    }

    public function update(LibraryTrackRequest $request, string $track, SaveTrack $save): JsonResponse
    {
        $found = $save->handle($request->user(), $request->validated(), $request->file('audio'), $request->file('cover'), $this->find($track));

        return response()->json(['track' => $this->present($found, $request)]);
    }

    public function destroy(string $track, DeleteTrack $delete): RedirectResponse
    {
        $found = $this->find($track);
        $delete->handle($found);

        return back()->with('success', "Eliminamos «{$found->title}» de la biblioteca.");
    }

    /** Puts a song in (or takes it out of) the automatic music. */
    public function rotation(string $track, PlayoutCaches $caches): RedirectResponse
    {
        $found = $this->find($track);
        abort_unless($found->kind === TrackKind::Song, 422, 'Solo las canciones pueden sonar en la música automática.');
        abort_unless($found->rotation || $found->active, 422, 'Activa el audio antes de ponerlo en la música automática.');
        $found->update(['rotation' => ! $found->rotation]);
        $caches->flush();

        return back()->with('success', $found->rotation
            ? "«{$found->title}» ahora suena en la música automática."
            : "«{$found->title}» ya no suena en la música automática.");
    }

    /** Authors and guests of the songs, the same name written alike counted once. */
    private function authors(): int
    {
        return Track::query()->where('kind', TrackKind::Song)->get(['artist', 'featured'])
            ->flatMap(fn (Track $track) => [$track->artist, ...($track->featured ?? [])])
            ->map(fn (?string $name) => Names::key($name))
            ->filter()
            ->unique()
            ->count();
    }

    /** @return array<string, mixed> */
    private function present(Track $track, Request $request): array
    {
        return LibraryTrackResource::make($track->loadCount(LibraryTrackResource::counts()))->resolve($request);
    }

    private function find(string $id): Track
    {
        return Track::query()->with('genres')->withCount(LibraryTrackResource::counts())->findOrFail($id);
    }
}
