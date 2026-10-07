<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Stations\Analytics\LocalTime;
use App\Domain\Stations\Analytics\StationAnalytics;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Stations\Support\Locales;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio > Estadísticas and > Audiencia, over the last 7, 30 or 90 days. */
class AnalyticsController extends Controller
{
    private const RANGES = [7, 30, 90];

    public function __construct(
        private readonly CurrentStation $current,
        private readonly StationAnalytics $analytics,
    ) {}

    public function stats(Request $request): Response
    {
        $station = $this->current->get();
        $range = $this->range($request);
        $from = LocalTime::startOfDay($range - 1);

        return Inertia::render('Studio/Stats', [
            'range' => $range,
            'ranges' => self::RANGES,
            'summary' => $this->analytics->summary($station, $from),
            'daily' => $this->analytics->daily($station, $from),
            'heatmap' => $this->analytics->heatmap($station, $from),
            'broadcasts' => $this->analytics->recentBroadcasts($station, 10),
        ]);
    }

    public function audience(Request $request): Response
    {
        $station = $this->current->get();
        $range = $this->range($request);
        $from = LocalTime::startOfDay($range - 1);

        return Inertia::render('Studio/Audience', [
            'range' => $range,
            'ranges' => self::RANGES,
            'summary' => $this->analytics->summary($station, $from),
            'countries' => array_map(fn (array $row) => [
                ...$row,
                'name' => $row['code'] === null ? 'Sin dato' : (Locales::COUNTRIES[$row['code']] ?? $row['code']),
            ], $this->analytics->countries($station, $from)),
            'devices' => $this->analytics->devices($station, $from),
            'growth' => $this->analytics->followerGrowth($station, $from),
            'topFollowers' => $this->analytics->topFollowers($station, $from),
        ]);
    }

    private function range(Request $request): int
    {
        $range = $request->integer('dias', 30);

        return in_array($range, self::RANGES, true) ? $range : 30;
    }
}
