<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Studio\Catalog\GenreFamily;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\Actions\DeleteTrack;
use App\Domain\Studio\Library\Actions\SaveTrack;
use App\Domain\Studio\Library\AudioFile;
use App\Domain\Studio\Library\AudioUploads;
use App\Domain\Studio\Library\Duplicates;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\LibraryTrackRequest;
use App\Http\Resources\LibraryTrackResource;
use App\Models\Genre;
use App\Models\Track;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Studio › Biblioteca: every audio of the station, by kind, with uploads, identification and file checks. */
class LibraryController extends Controller
{
    public function index(Request $request, AudioUploads $uploads): Response
    {
        $kind = TrackKind::tryFrom((string) $request->query('tipo')) ?? TrackKind::Song;
        $search = trim((string) $request->query('buscar'));
        $problems = $request->boolean('revision');

        $tracks = Track::query()
            ->with('genres')
            ->when(! $problems, fn (Builder $query) => $query->where('kind', $kind->value))
            ->when($problems, fn (Builder $query) => $query->whereNotNull('file_problem'))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $match) => $match
                ->where('title', 'like', "%{$search}%")
                ->orWhere('artist', 'like', "%{$search}%")
                ->orWhere('album', 'like', "%{$search}%")))
            ->when($request->boolean('rotacion'), fn (Builder $query) => $query->where('rotation', true))
            ->latest()
            ->paginate(30)
            ->withQueryString()
            ->through(fn (Track $track) => LibraryTrackResource::make($track)->resolve($request));

        $counts = Track::query()->selectRaw('kind, count(*) as total')->groupBy('kind')->pluck('total', 'kind');

        return Inertia::render('Studio/Library', [
            'tracks' => $tracks,
            'filters' => ['kind' => $kind->value, 'search' => $search, 'problems' => $problems, 'rotation' => $request->boolean('rotacion')],
            'kinds' => collect(TrackKind::cases())->map(fn (TrackKind $case) => [
                'value' => $case->value,
                'label' => $case->label(),
                'count' => (int) ($counts[$case->value] ?? 0),
            ])->values(),
            'problems' => Track::query()->whereNotNull('file_problem')->count(),
            'genres' => Genre::query()->orderBy('sort_order')->orderBy('name')->get()->map(fn (Genre $genre) => $genre->brief())->values(),
            'families' => GenreFamily::options(),
            'limits' => [
                'direct' => $uploads->direct(),
                'max_mb' => $uploads->maxMegabytes(),
                'max_cover_mb' => (int) config('platform.media.max_cover_mb'),
                'max_duration' => AudioFile::maxDuration(),
                'max_featured' => Track::MAX_FEATURED,
                'max_genres' => Track::MAX_GENRES,
                'types' => AudioFile::TYPES,
            ],
        ]);
    }

    public function store(LibraryTrackRequest $request, SaveTrack $save, Duplicates $duplicates): JsonResponse
    {
        $data = $request->validated();
        $kind = TrackKind::from($data['kind']);
        if (! $request->boolean('duplicate_ok')) {
            $same = $duplicates->exact($kind, $data['title'], $data['artist'] ?? null, (float) $data['duration']);
            if ($same->isNotEmpty()) {
                return response()->json([
                    'message' => 'Este audio ya está en la biblioteca.',
                    'duplicates' => $same,
                ], 409);
            }
        }

        $track = $save->handle($request->user(), $data, $request->file('audio'), $request->file('cover'));

        return response()->json(['track' => LibraryTrackResource::make($track)->resolve($request)], 201);
    }

    public function update(LibraryTrackRequest $request, string $track, SaveTrack $save): JsonResponse
    {
        $found = $save->handle($request->user(), $request->validated(), $request->file('audio'), $request->file('cover'), $this->find($track));

        return response()->json(['track' => LibraryTrackResource::make($found)->resolve($request)]);
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
        $found->update(['rotation' => ! $found->rotation]);
        $caches->flush();

        return back()->with('success', $found->rotation
            ? "«{$found->title}» ahora suena en la música automática."
            : "«{$found->title}» ya no suena en la música automática.");
    }

    private function find(string $id): Track
    {
        return Track::query()->with('genres')->findOrFail($id);
    }
}
