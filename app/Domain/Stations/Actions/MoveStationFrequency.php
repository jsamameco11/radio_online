<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Marketplace\Enums\ListingStatus;
use App\Models\Frequency;
use App\Models\FrequencyListing;
use App\Models\Station;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Moves a station to another free frequency: its public address changes
 * (/radio/95-50), the old frequency becomes available again. If the platform
 * was selling the target frequency, that listing is withdrawn.
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
                'price_cents' => null,
                'reserved_at' => null,
                'activated_at' => now(),
            ])->save();
            $previous->forceFill(['status' => FrequencyStatus::Available, 'reserved_at' => null, 'activated_at' => null])->save();
            FrequencyListing::query()->active()->where('frequency_id', $target->id)->update([
                'status' => ListingStatus::Cancelled->value,
                'cancelled_at' => now(),
            ]);
            FrequencyListing::query()->active()->where('station_id', $station->id)->update(['frequency_id' => $target->id]);

            return $station->setRelation('frequency', $target);
        });
    }
}
