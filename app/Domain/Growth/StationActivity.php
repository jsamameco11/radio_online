<?php

namespace App\Domain\Growth;

use App\Domain\Stations\Analytics\LocalTime;
use App\Models\Episode;
use App\Models\Station;
use App\Models\StreamSession;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;

/**
 * What a station did, day by day in the platform timezone: the days it went
 * live, the days it published an episode and the peak live audience of
 * each day. A live broadcast belongs to the day it started.
 */
final class StationActivity
{
    /** @return list<string> */
    public function liveDays(Station $station): array
    {
        return $this->distinctDays(
            StreamSession::acrossStations()->where('station_id', $station->id)->toBase(),
            'started_at',
        );
    }

    /** @return list<string> */
    public function episodeDays(Station $station): array
    {
        return $this->distinctDays(
            Episode::acrossStations()->where('station_id', $station->id)->whereNotNull('published_at')->toBase(),
            'published_at',
        );
    }

    /**
     * Highest simultaneous live audience per day since $from, only for the days with a broadcast.
     *
     * @return array<string, int>
     */
    public function dailyPeaks(Station $station, CarbonImmutable $from, int $minimum = 0): array
    {
        return StreamSession::acrossStations()
            ->toBase()
            ->where('station_id', $station->id)
            ->where('started_at', '>=', $from)
            ->where('peak_listeners', '>=', $minimum)
            ->selectRaw(LocalTime::day('started_at').' as day, max(peak_listeners) as peak')
            ->groupBy('day')
            ->pluck('peak', 'day')
            ->map(fn (mixed $peak) => (int) $peak)
            ->all();
    }

    /**
     * @return array{episodes: int, lives: int, best_peak: int}
     */
    public function totals(Station $station): array
    {
        $lives = StreamSession::acrossStations()->where('station_id', $station->id)->toBase()
            ->selectRaw('count(*) as lives, coalesce(max(peak_listeners), 0) as best_peak')
            ->first();

        return [
            'episodes' => Episode::acrossStations()->where('station_id', $station->id)->whereNotNull('published_at')->count(),
            'lives' => (int) $lives->lives,
            'best_peak' => (int) $lives->best_peak,
        ];
    }

    /** @return list<string> */
    private function distinctDays(Builder $query, string $column): array
    {
        return $query->selectRaw(LocalTime::day($column).' as day')
            ->distinct()
            ->pluck('day')
            ->map(fn (mixed $day) => (string) $day)
            ->sort()
            ->values()
            ->all();
    }
}
