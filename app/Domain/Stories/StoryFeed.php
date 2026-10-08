<?php

namespace App\Domain\Stories;

use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Models\Station;
use App\Models\StationStory;
use App\Models\StationStoryView;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

/** The stories listeners watch: the rail of stations that have some and each station's own. */
final class StoryFeed
{
    public function __construct(private readonly StationDirectory $stations) {}

    /**
     * Discoverable stations with active stories: the ones the user follows first, then the
     * ones live now, then the most recent. "seen" tells whether the viewer watched all of them.
     *
     * @return list<array{station: Station, count: int, latest_at: CarbonImmutable, seen: bool}>
     */
    public function rail(?User $user, string $viewerKey, int $limit = 40): array
    {
        $stations = $this->stations->query()
            ->whereIn('stations.id', StationStory::acrossStations()->active()->select('station_id'))
            ->when($user, fn ($query) => $query->orderByRaw(
                'case when exists (select 1 from follows where follows.station_id = stations.id and follows.user_id = ?) then 0 else 1 end',
                [$user->id],
            ))
            ->orderByRaw('case when stream_status = ? then 0 else 1 end', [StreamStatus::Live->value])
            ->orderByDesc(StationStory::acrossStations()->active()->selectRaw('max(created_at)')->whereColumn('station_stories.station_id', 'stations.id'))
            ->orderBy('stations.id')
            ->limit($limit)
            ->get();
        if ($stations->isEmpty()) {
            return [];
        }

        $ids = $stations->modelKeys();
        $totals = StationStory::acrossStations()->active()
            ->whereIn('station_id', $ids)
            ->toBase()
            ->selectRaw('station_id, count(*) as total, max(created_at) as latest')
            ->groupBy('station_id')
            ->get()
            ->keyBy('station_id');
        $seen = StationStoryView::query()
            ->join('station_stories', 'station_stories.id', '=', 'station_story_views.story_id')
            ->where('station_story_views.viewer_key', $viewerKey)
            ->whereIn('station_stories.station_id', $ids)
            ->where('station_stories.expires_at', '>', now())
            ->toBase()
            ->selectRaw('station_stories.station_id, count(*) as total')
            ->groupBy('station_stories.station_id')
            ->pluck('total', 'station_id');

        return $stations->map(function (Station $station) use ($totals, $seen) {
            $count = (int) $totals[$station->id]->total;

            return [
                'station' => $station,
                'count' => $count,
                'latest_at' => CarbonImmutable::parse($totals[$station->id]->latest),
                'seen' => (int) ($seen[$station->id] ?? 0) >= $count,
            ];
        })->values()->all();
    }

    /**
     * The active stories of a station, oldest first, each telling whether the viewer saw it.
     *
     * @return Collection<int, StationStory>
     */
    public function ofStation(Station $station, string $viewerKey): Collection
    {
        return StationStory::acrossStations()
            ->active()
            ->where('station_id', $station->id)
            ->withExists(['views as seen' => fn ($query) => $query->where('viewer_key', $viewerKey)])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();
    }
}
