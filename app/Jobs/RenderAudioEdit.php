<?php

namespace App\Jobs;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Editor\AudioEditor;
use App\Domain\Studio\Editor\EditStatus;
use App\Models\Station;
use App\Models\Track;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use RuntimeException;
use Throwable;

/**
 * Renders an edit of a library audio with ffmpeg (see AudioEditor). The editor polls the
 * audio's edit status: cleared when the new file is in place, "failed" with a message otherwise.
 *
 * @phpstan-import-type Recipe from \App\Domain\Studio\Editor\EditRecipe
 */
class RenderAudioEdit implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 3 * 3600;

    /** @param  Recipe  $recipe */
    public function __construct(
        public readonly int $stationId,
        public readonly string $trackId,
        public readonly array $recipe,
    ) {
        $this->onConnection(config('queue.media_connection'));
    }

    public function handle(CurrentStation $current, AudioEditor $editor): void
    {
        $station = Station::query()->find($this->stationId);
        if ($station === null) {
            return;
        }
        $current->within($station, function () use ($editor) {
            $track = Track::query()->find($this->trackId);
            if ($track === null) {
                return;
            }
            try {
                $editor->render($track, $this->recipe);
            } catch (RuntimeException $exception) {
                $this->markFailed($track, $exception->getMessage());
            }
        });
    }

    public function failed(?Throwable $exception): void
    {
        Track::acrossStations()->whereKey($this->trackId)->where('edit_status', EditStatus::Processing->value)->update([
            'edit_status' => EditStatus::Failed->value,
            'edit_error' => 'El procesamiento se interrumpió. Inténtalo de nuevo.',
        ]);
    }

    private function markFailed(Track $track, string $message): void
    {
        $track->forceFill(['edit_status' => EditStatus::Failed->value, 'edit_error' => mb_substr($message, 0, 300)])->save();
    }
}
