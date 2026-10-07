<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Stations\Enums\StationStatus;
use App\Models\Frequency;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Lifts a suspension: the station is discoverable again and may go back on the air. */
final class ReactivateStation
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Station $station, ?string $note, User $actor): Station
    {
        $station = DB::transaction(function () use ($station) {
            $station = Station::query()->lockForUpdate()->findOrFail($station->id);

            if ($station->status !== StationStatus::Suspended) {
                throw ValidationException::withMessages(['station' => 'La emisora no está suspendida.']);
            }

            $station->forceFill(['status' => StationStatus::Active, 'suspended_at' => null, 'suspension_reason' => null])->save();

            $frequency = Frequency::query()->lockForUpdate()->findOrFail($station->frequency_id);
            if ($frequency->status === FrequencyStatus::Suspended) {
                $frequency->forceFill(['status' => FrequencyStatus::Active])->save();
            }

            return $station;
        });

        $this->audit->record('station.reactivated', $station, array_filter(['note' => $note]), $actor);

        return $station;
    }
}
