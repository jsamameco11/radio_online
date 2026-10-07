<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Models\Frequency;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Takes a station off the platform: it disappears from discovery, goes off
 * the air and its frequency shows as suspended. Its team keeps the studio.
 */
final class SuspendStation
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Station $station, string $reason, User $actor): Station
    {
        $station = DB::transaction(function () use ($station, $reason) {
            $station = Station::query()->lockForUpdate()->findOrFail($station->id);

            if ($station->status === StationStatus::Suspended) {
                throw ValidationException::withMessages(['reason' => 'La emisora ya está suspendida.']);
            }

            $station->forceFill([
                'status' => StationStatus::Suspended,
                'suspended_at' => now(),
                'suspension_reason' => $reason,
                'stream_status' => StreamStatus::Offline,
                'listener_count' => 0,
            ])->save();

            $frequency = Frequency::query()->lockForUpdate()->findOrFail($station->frequency_id);
            if ($frequency->status !== FrequencyStatus::Maintenance) {
                $frequency->forceFill(['status' => FrequencyStatus::Suspended])->save();
            }

            return $station;
        });

        $this->audit->record('station.suspended', $station, ['reason' => $reason], $actor);

        return $station;
    }
}
