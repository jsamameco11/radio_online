<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\Actions\ArrangePlaylists;
use App\Domain\Studio\Library\Actions\SavePlaylist;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\PlaylistOrderRequest;
use App\Http\Requests\Studio\PlaylistRequest;
use App\Models\Playlist;
use App\Models\Track;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/** Studio › Listas: songs in the order the programmer chose, for the automatic music and the schedule. */
class PlaylistController extends Controller
{
    public function index(StationBroadcast $broadcast): Response
    {
        $song = fn (Track $track) => [
            'id' => $track->id,
            'title' => $track->title,
            'credit' => $track->credit(),
            'duration' => (float) $track->duration,
            'playable' => $track->active && $track->file_problem === null,
        ];

        return Inertia::render('Studio/Playlists', [
            'playlists' => Playlist::query()
                ->with('tracks')
                ->orderBy('sort_order')->orderBy('created_at')
                ->get()
                ->map(fn (Playlist $playlist) => [
                    'id' => $playlist->id,
                    'name' => $playlist->name,
                    'description' => $playlist->description,
                    'duration' => (float) $playlist->tracks->sum('duration'),
                    'tracks' => $playlist->tracks->map($song)->values(),
                ]),
            'songs' => Track::query()
                ->where('kind', TrackKind::Song->value)
                ->orderBy('title')
                ->get(['id', 'title', 'artist', 'featured', 'duration', 'active', 'file_problem'])
                ->map($song),
            'maxTracks' => SavePlaylist::MAX_TRACKS,
            'autopilot' => $broadcast->autopilot(),
        ]);
    }

    public function store(PlaylistRequest $request, SavePlaylist $save): RedirectResponse
    {
        $playlist = $save->handle($request->validated());

        return back()->with('success', "Creamos la lista «{$playlist->name}».");
    }

    public function update(PlaylistRequest $request, string $playlist, SavePlaylist $save): RedirectResponse
    {
        $saved = $save->handle($request->validated(), $this->find($playlist));

        return back()->with('success', "Guardamos la lista «{$saved->name}».");
    }

    public function destroy(string $playlist, ArrangePlaylists $arrange): RedirectResponse
    {
        $found = $this->find($playlist);
        $switched = $arrange->delete($found);

        return back()->with('success', "Eliminamos la lista «{$found->name}».".($switched
            ? ' La música automática la estaba usando: ahora suenan canciones aleatorias.'
            : ''));
    }

    public function order(PlaylistOrderRequest $request, ArrangePlaylists $arrange): RedirectResponse
    {
        $arrange->reorder($request->validated('ids'));

        return back()->with('success', 'Guardamos el orden de las listas.');
    }

    public function shuffle(string $playlist, ArrangePlaylists $arrange): RedirectResponse
    {
        $found = $this->find($playlist);
        $arrange->shuffle($found);

        return back()->with('success', "Mezclamos las canciones de «{$found->name}».");
    }

    private function find(string $id): Playlist
    {
        return Playlist::query()->findOrFail($id);
    }
}
