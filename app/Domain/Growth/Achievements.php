<?php

namespace App\Domain\Growth;

use App\Domain\Monetization\Notifications\MonetizationReady;
use App\Domain\Stations\Support\StationLinks;
use App\Models\Station;
use App\Models\StationAchievement;
use Carbon\CarbonImmutable;

/**
 * The milestones a station unlocked. Each one is written once, with the
 * moment it was first seen, so it stays unlocked (even if a figure drops
 * later) and is celebrated a single time.
 */
final class Achievements
{
    /** Unlocked when a station first meets every monetization requirement. */
    public const MONETIZATION_READY = 'monetization_ready';

    /** How long an unlocked milestone is shown as recent. */
    public const RECENT_DAYS = 7;

    /**
     * Records the reached keys not unlocked before.
     *
     * @param  list<string>  $reached
     * @return array{achieved: array<string, CarbonImmutable>, fresh: list<string>}
     */
    public function unlock(Station $station, array $reached): array
    {
        $achieved = $this->achieved($station);
        $fresh = array_values(array_diff(array_unique($reached), array_keys($achieved)));

        if ($fresh !== []) {
            $now = now();
            StationAchievement::query()->insertOrIgnore(array_map(fn (string $key) => [
                'station_id' => $station->id,
                'key' => $key,
                'achieved_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ], $fresh));
            $achieved = $this->achieved($station);

            if (in_array(self::MONETIZATION_READY, $fresh, true) && ! $station->isMonetized()) {
                $station->loadMissing(['frequency', 'owner']);
                $station->owner?->notify(new MonetizationReady($station->id, $station->displayName(), StationLinks::studio($station).'/monetizacion'));
            }
        }

        return ['achieved' => $achieved, 'fresh' => $fresh];
    }

    /** @return array<string, CarbonImmutable> */
    private function achieved(Station $station): array
    {
        return StationAchievement::acrossStations()
            ->where('station_id', $station->id)
            ->get(['key', 'achieved_at'])
            ->mapWithKeys(fn (StationAchievement $achievement) => [$achievement->key => $achievement->achieved_at->toImmutable()])
            ->all();
    }
}
