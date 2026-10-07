<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\StudioAccess;
use App\Domain\Studio\Recordings\Actions\ConvertRecording;
use App\Domain\Studio\Recordings\Actions\DeleteRecording;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\RecordingConvertRequest;
use App\Http\Resources\RecordingResource;
use App\Models\Recording;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Studio › Grabaciones: what the console recorded, to keep as library audio or episode, or to discard. */
class RecordingController extends Controller
{
    public function index(Request $request, StudioAccess $access): Response
    {
        return Inertia::render('Studio/Recordings', [
            'recordings' => Recording::query()
                ->with(['user', 'track'])
                ->latest('started_at')
                ->paginate(20)
                ->withQueryString()
                ->through(fn (Recording $recording) => RecordingResource::make($recording)->resolve($request)),
            'kinds' => collect(TrackKind::cases())->map(fn (TrackKind $kind) => ['value' => $kind->value, 'label' => $kind->label()])->values(),
            'canEpisodes' => $access->allows($request->user(), StationPermission::ManageEpisodes),
        ]);
    }

    public function convert(RecordingConvertRequest $request, string $recording, ConvertRecording $convert, StudioAccess $access): RedirectResponse
    {
        $data = $request->validated();
        if (! empty($data['episode'])) {
            $access->authorize($request->user(), StationPermission::ManageEpisodes);
        }
        $track = $convert->handle(Recording::query()->findOrFail($recording), $data);

        return back()->with('success', ! empty($data['episode'])
            ? "Guardamos «{$track->title}» en la biblioteca y creamos su episodio como borrador."
            : "Guardamos «{$track->title}» en la biblioteca.");
    }

    public function destroy(string $recording, DeleteRecording $delete): RedirectResponse
    {
        $delete->handle(Recording::query()->findOrFail($recording));

        return back()->with('success', 'Eliminamos la grabación.');
    }
}
