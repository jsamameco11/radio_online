<?php

namespace App\Domain\Streaming\Support;

use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Stations\Support\CurrentStation;
use App\Models\Station;
use Illuminate\Http\Request;

/** Tunes a listener's request to the station of a frequency ("89-30"), which becomes the current station. */
final class Tuner
{
    public function __construct(private readonly CurrentStation $current) {}

    public function tune(string $slug): Station
    {
        $station = Station::query()
            ->whereHas('frequency', fn ($query) => $query->where('slug', $slug))
            ->where('status', StationStatus::Active->value)
            ->with('frequency')
            ->firstOrFail();
        $this->current->set($station);

        return $station;
    }

    /** The kind of device a player runs on, from its user agent. */
    public static function device(Request $request): string
    {
        $agent = strtolower((string) $request->userAgent());

        return match (true) {
            str_contains($agent, 'ipad') || str_contains($agent, 'tablet') => 'tablet',
            str_contains($agent, 'mobi') || str_contains($agent, 'android') || str_contains($agent, 'iphone') => 'mobile',
            default => 'desktop',
        };
    }

    /** The listener's country when the proxy in front of the platform reports it. */
    public static function country(Request $request): ?string
    {
        $country = strtoupper((string) $request->header('CF-IPCountry'));

        return preg_match('/^[A-Z]{2}$/', $country) && $country !== 'XX' ? $country : null;
    }
}
