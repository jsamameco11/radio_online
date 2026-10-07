<?php

namespace App\Jobs;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Library\FileHealth;
use App\Models\Station;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Checks every file of a station library (see FileHealth). */
class CheckLibraryFiles implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $timeout = 1800;

    public int $uniqueFor = 1800;

    public function __construct(public readonly int $stationId) {}

    public function uniqueId(): string
    {
        return (string) $this->stationId;
    }

    public function handle(CurrentStation $current): void
    {
        $station = Station::query()->find($this->stationId);
        if ($station === null) {
            return;
        }
        $current->within($station, fn () => app(FileHealth::class)->checkAll());
    }
}
