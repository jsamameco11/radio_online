<?php

namespace App\Domain\Stations\Support;

use App\Models\Station;
use App\Models\StationSetting;
use Illuminate\Support\Facades\Cache;

/**
 * Settings groups of a station ("broadcast", "audio", "automation", "gifts"…).
 *
 * Each group is one JSON row in station_settings. Reads merge the stored
 * values over the defaults the caller provides, so adding a new option never
 * needs a migration; writes replace only the keys given.
 */
final class StationSettings
{
    /**
     * @param  array<string, mixed>  $defaults
     * @return array<string, mixed>
     */
    public function get(Station $station, string $group, array $defaults = []): array
    {
        $stored = Cache::rememberForever(self::cacheKey($station, $group), fn () => StationSetting::query()
            ->where('station_id', $station->id)
            ->where('key', $group)
            ->value('value') ?? []);

        return array_replace($defaults, array_intersect_key($stored, $defaults ?: $stored));
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed> The whole stored group after the update.
     */
    public function put(Station $station, string $group, array $values): array
    {
        $setting = StationSetting::query()->firstOrNew(['station_id' => $station->id, 'key' => $group]);
        $setting->value = array_replace($setting->value ?? [], $values);
        $setting->updated_at = now();
        $setting->save();

        Cache::forget(self::cacheKey($station, $group));

        return $setting->value;
    }

    public function forget(Station $station, string $group): void
    {
        StationSetting::query()->where('station_id', $station->id)->where('key', $group)->delete();
        Cache::forget(self::cacheKey($station, $group));
    }

    private static function cacheKey(Station $station, string $group): string
    {
        return "station:{$station->id}:settings:{$group}";
    }
}
