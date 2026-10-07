<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Models\CurrentTopic;
use App\Models\Frequency;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Closes a station for good: it goes off the air, its team loses the
 * studio and the station is archived (soft deleted, history and money kept).
 * The frequency stays reserved until the platform staff releases it.
 */
final class CloseStation
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Station $station, User $actor): void
    {
        $station = DB::transaction(function () use ($station) {
            $station = Station::query()->lockForUpdate()->findOrFail($station->id);

            $station->forceFill([
                'stream_status' => StreamStatus::Offline,
                'listener_count' => 0,
                'current_topic_id' => null,
            ])->save();
            CurrentTopic::acrossStations()->where('station_id', $station->id)->whereNull('ended_at')->update(['ended_at' => now()]);
            $station->members()->delete();
            $station->delete();

            Frequency::query()->lockForUpdate()->findOrFail($station->frequency_id)
                ->forceFill(['status' => FrequencyStatus::Reserved, 'reserved_at' => now()])
                ->save();

            return $station;
        });

        $this->audit->record('station.closed', $station, ['frequency_id' => $station->frequency_id], $actor);
    }
}
