<?php

namespace App\Jobs;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Streaming\PlaybackHealth;
use App\Models\Station;
use App\Models\Track;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Checks the file of a library audio a listener's player could not play. */
final class VerifyTrackFile implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $stationId,
        public readonly string $trackId,
        public readonly bool $reported,
    ) {}

    public function handle(CurrentStation $current): void
    {
        $station = Station::query()->find($this->stationId);
        if ($station === null) {
            return;
        }

        $current->within($station, function () {
            $track = Track::query()->find($this->trackId);
            if ($track !== null) {
                app(PlaybackHealth::class)->check($track, $this->reported);
            }
        });
    }
}
