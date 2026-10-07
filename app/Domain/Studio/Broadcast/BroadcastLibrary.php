<?php

namespace App\Domain\Studio\Broadcast;

use App\Domain\Studio\Enums\TrackKind;
use App\Http\Resources\BroadcastTrackResource;
use App\Models\Playlist;
use App\Models\Track;
use Illuminate\Http\Request;

/** What the console and the schedule choose from: the active audios of the library and the playlists. */
final class BroadcastLibrary
{
    /** @return list<array<string, mixed>> */
    public function tracks(Request $request): array
    {
        $tracks = Track::query()->where('active', true)
            ->orderByRaw('case kind when ? then 0 when ? then 1 when ? then 2 when ? then 3 else 4 end', [
                TrackKind::Song->value, TrackKind::Program->value, TrackKind::Jingle->value, TrackKind::Commercial->value,
            ])
            ->orderBy('title')
            ->get();

        return BroadcastTrackResource::collection($tracks)->resolve($request);
    }

    /** @return list<array{id: string, name: string, songs: int}> */
    public function playlists(): array
    {
        return Playlist::query()->withCount('tracks')->orderBy('sort_order')->orderBy('created_at')->get()
            ->map(fn (Playlist $playlist) => ['id' => $playlist->id, 'name' => $playlist->name, 'songs' => (int) $playlist->tracks_count])
            ->values()->all();
    }

    /** @return list<array{value: string, label: string}> */
    public static function kinds(): array
    {
        return collect(TrackKind::cases())->map(fn (TrackKind $kind) => ['value' => $kind->value, 'label' => $kind->label()])->values()->all();
    }
}
