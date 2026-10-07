<?php

namespace App\Domain\Studio\Library\Actions;

use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\Playlist;
use Illuminate\Support\Facades\DB;

/** Orders the playlists, shuffles the songs of one once and deletes playlists. */
final class ArrangePlaylists
{
    public function __construct(private readonly PlayoutCaches $caches) {}

    /** @param  list<string>  $ids  Playlists of the station in their new order; any missing keep their place after them. */
    public function reorder(array $ids): void
    {
        $known = Playlist::query()->orderBy('sort_order')->orderBy('created_at')->pluck('id')->all();
        $order = [...array_values(array_intersect(array_unique($ids), $known)), ...array_diff($known, $ids)];
        DB::transaction(function () use ($order) {
            foreach ($order as $position => $id) {
                Playlist::query()->whereKey($id)->update(['sort_order' => $position + 1]);
            }
        });
        $this->caches->flush();
    }

    /** Gives the songs of a playlist a new random order, kept until it is changed again. */
    public function shuffle(Playlist $playlist): void
    {
        $ids = $playlist->tracks()->pluck('tracks.id')->shuffle()->values();
        DB::transaction(function () use ($playlist, $ids) {
            foreach ($ids as $position => $id) {
                $playlist->tracks()->updateExistingPivot($id, ['position' => $position]);
            }
        });
        $this->caches->flush();
    }

    public function delete(Playlist $playlist): void
    {
        DB::transaction(function () use ($playlist) {
            $playlist->tracks()->detach();
            $playlist->delete();
        });
        $this->caches->flush();
    }
}
