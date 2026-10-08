<?php

namespace App\Domain\Studio\Library\Actions;

use App\Domain\Studio\Broadcast\BroadcastClock;
use App\Domain\Studio\Broadcast\Schedule;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\Playlist;
use App\Models\ScheduleSlot;
use Illuminate\Support\Facades\DB;

/** Orders the playlists, shuffles the songs of one once and deletes playlists. */
final class ArrangePlaylists
{
    public function __construct(
        private readonly PlayoutCaches $caches,
        private readonly StationBroadcast $broadcast,
    ) {}

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

    /**
     * Deletes a playlist. The automatic periods that played it play random songs from then on,
     * and so does the automatic music of the gaps when it played (or was about to play) it.
     *
     * @return bool whether the automatic music of the gaps had to change
     */
    public function delete(Playlist $playlist): bool
    {
        DB::transaction(function () use ($playlist) {
            ScheduleSlot::query()->where('playlist_id', $playlist->id)->update([
                'playlist_id' => null,
                'shuffle' => true,
                'title' => Schedule::autoTitle(null, true),
            ]);
            $playlist->tracks()->detach();
            $playlist->delete();
        });
        $this->caches->flush();

        return $this->releaseAutopilot($playlist->id);
    }

    private function releaseAutopilot(string $playlist): bool
    {
        $config = $this->broadcast->config();
        $playing = is_array($config['auto_prev']) && (int) $config['auto_since'] > BroadcastClock::nowMs() ? ($config['auto_prev']['playlist'] ?? null) : null;
        if ($config['auto_playlist'] !== $playlist && $playing !== $playlist) {
            return false;
        }
        $next = $config['auto_playlist'] === $playlist ? null : $config['auto_playlist'];
        $this->broadcast->switchAutopilot($next, (bool) $config['auto_shuffle'], true);

        return true;
    }
}
