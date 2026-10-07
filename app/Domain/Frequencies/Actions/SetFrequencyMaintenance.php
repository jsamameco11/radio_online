<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Stations\Enums\StationStatus;
use App\Models\Frequency;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Takes a frequency out of service for maintenance, or puts it back in the
 * state its station (or reservation) implies.
 */
final class SetFrequencyMaintenance
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Frequency $frequency, bool $maintenance, User $actor): Frequency
    {
        $frequency = DB::transaction(function () use ($frequency, $maintenance) {
            $frequency = Frequency::query()->lockForUpdate()->findOrFail($frequency->id);
            $station = $frequency->station()->first();

            $status = match (true) {
                $maintenance => FrequencyStatus::Maintenance,
                $station !== null => $station->status === StationStatus::Suspended ? FrequencyStatus::Suspended : FrequencyStatus::Active,
                $frequency->reserved_at !== null => FrequencyStatus::Reserved,
                default => FrequencyStatus::Available,
            };

            $frequency->forceFill(['status' => $status])->save();

            return $frequency;
        });

        $this->audit->record($maintenance ? 'frequency.maintenance_started' : 'frequency.maintenance_ended', $frequency, [], $actor);

        return $frequency;
    }
}
