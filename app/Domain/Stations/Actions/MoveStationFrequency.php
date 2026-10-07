<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Models\Frequency;
use App\Models\Station;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Moves a station to another free frequency: its public address changes
 * (/radio/95-50), the old frequency becomes available again.
 */
final class MoveStationFrequency
{
    public function handle(Station $station, Frequency $target): Station
    {
        return DB::transaction(function () use ($station, $target) {
            $station = Station::query()->lockForUpdate()->findOrFail($station->id);
            $target = Frequency::query()->lockForUpdate()->findOrFail($target->id);
            $previous = Frequency::query()->lockForUpdate()->findOrFail($station->frequency_id);

            if ($target->is($previous)) {
                throw ValidationException::withMessages(['frequency' => 'La emisora ya transmite en esa frecuencia.']);
            }

            if (! in_array($target->status, [FrequencyStatus::Available, FrequencyStatus::Reserved], true) || $target->station()->exists()) {
                throw ValidationException::withMessages(['frequency' => "La frecuencia {$target->display()} ya no está libre."]);
            }

            $station->forceFill(['frequency_id' => $target->id])->save();
            $target->forceFill([
                'status' => $previous->status === FrequencyStatus::Suspended ? FrequencyStatus::Suspended : FrequencyStatus::Active,
                'reserved_at' => null,
                'activated_at' => now(),
            ])->save();
            $previous->forceFill(['status' => FrequencyStatus::Available, 'reserved_at' => null, 'activated_at' => null])->save();

            return $station->setRelation('frequency', $target);
        });
    }
}
