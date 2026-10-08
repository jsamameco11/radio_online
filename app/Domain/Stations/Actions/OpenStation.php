<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Discovery\Hashtags;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Marketplace\Enums\ListingStatus;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Stations\Enums\StationVisibility;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Models\Frequency;
use App\Models\FrequencyListing;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Puts a new station on an available or reserved frequency: the frequency
 * becomes active (and leaves the market if the platform was selling it), the
 * owner joins the team and the station keeps up to three categories and its
 * permanent hashtags.
 */
final class OpenStation
{
    /**
     * @param  list<int>  $categoryIds
     * @param  list<string>  $hashtags
     */
    public function handle(User $owner, Frequency $frequency, string $name, array $categoryIds = [], array $hashtags = [], ?string $description = null): Station
    {
        return DB::transaction(function () use ($owner, $frequency, $name, $categoryIds, $hashtags, $description) {
            $frequency = Frequency::query()->lockForUpdate()->findOrFail($frequency->id);

            if (! in_array($frequency->status, [FrequencyStatus::Available, FrequencyStatus::Reserved], true) || $frequency->station()->exists()) {
                throw new InvalidArgumentException("The frequency {$frequency->label} is not free.");
            }

            $station = Station::query()->create([
                'frequency_id' => $frequency->id,
                'owner_id' => $owner->id,
                'name' => $name,
                'description' => $description,
                'status' => StationStatus::Active,
                'visibility' => StationVisibility::Public,
                'stream_status' => StreamStatus::Offline,
            ]);

            $station->members()->create(['user_id' => $owner->id, 'role' => StationRole::Owner]);

            $station->categories()->sync(
                collect($categoryIds)
                    ->unique()
                    ->take((int) config('platform.stations.max_categories'))
                    ->values()
                    ->mapWithKeys(fn (int $id, int $position) => [$id => ['position' => $position]])
                    ->all(),
            );

            Hashtags::sync($station->hashtags(), $hashtags, (int) config('platform.stations.max_permanent_hashtags'));

            $frequency->forceFill(['status' => FrequencyStatus::Active, 'price_cents' => null, 'activated_at' => now()])->save();
            FrequencyListing::query()->active()->where('frequency_id', $frequency->id)->update([
                'status' => ListingStatus::Cancelled->value,
                'cancelled_at' => now(),
            ]);

            return $station->setRelation('frequency', $frequency);
        });
    }
}
