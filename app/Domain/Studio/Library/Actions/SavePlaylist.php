<?php

namespace App\Domain\Studio\Library\Actions;

use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\Playlist;
use App\Models\Track;
use Illuminate\Support\Facades\DB;

/** Creates or changes a playlist: its name, description and its songs in order. */
final class SavePlaylist
{
    public const MAX_TRACKS = 2000;

    public function __construct(private readonly PlayoutCaches $caches) {}

    /**
     * @param  array{name: string, description?: ?string, track_ids?: list<string>}  $data
     */
    public function handle(array $data, ?Playlist $playlist = null): Playlist
    {
        $playlist ??= new Playlist(['sort_order' => (int) Playlist::query()->max('sort_order') + 1]);

        DB::transaction(function () use ($playlist, $data) {
            $playlist->fill([
                'name' => trim($data['name']),
                'description' => filled($data['description'] ?? null) ? trim((string) $data['description']) : null,
            ])->save();

            $wanted = array_values(array_unique($data['track_ids'] ?? []));
            $songs = Track::query()->whereKey($wanted)->where('kind', TrackKind::Song->value)->pluck('id')->flip();
            $ordered = array_values(array_filter($wanted, fn (string $id) => $songs->has($id)));
            $playlist->tracks()->sync(collect($ordered)->mapWithKeys(fn (string $id, int $position) => [$id => ['position' => $position]])->all());
        });
        $this->caches->flush();

        return $playlist;
    }
}
