<?php

namespace App\Domain\Discovery\Queries;

use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Stations\Enums\StationVisibility;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Models\Hashtag;
use Illuminate\Support\Facades\DB;

/**
 * Hashtags people are talking about: first those in the topics on air right
 * now (by how many stations use them), then the most used overall.
 */
final class TrendingHashtags
{
    /**
     * @return list<array{name: string, slug: string, uses_count: int, on_air: int}>
     */
    public function top(int $limit): array
    {
        $onAir = DB::table('current_topic_hashtag')
            ->join('stations', 'stations.current_topic_id', '=', 'current_topic_hashtag.current_topic_id')
            ->where('stations.status', StationStatus::Active->value)
            ->where('stations.visibility', StationVisibility::Public->value)
            ->whereIn('stations.stream_status', [StreamStatus::Live->value, StreamStatus::Online->value])
            ->whereNull('stations.deleted_at')
            ->groupBy('current_topic_hashtag.hashtag_id')
            ->select('current_topic_hashtag.hashtag_id')
            ->selectRaw('count(*) as stations');

        return Hashtag::query()
            ->leftJoinSub($onAir, 'on_air', 'on_air.hashtag_id', '=', 'hashtags.id')
            ->select('hashtags.name', 'hashtags.slug', 'hashtags.uses_count')
            ->selectRaw('coalesce(on_air.stations, 0) as on_air_count')
            ->where(fn ($query) => $query->whereNotNull('on_air.stations')->orWhere('hashtags.uses_count', '>', 0))
            ->orderByDesc('on_air_count')
            ->orderByDesc('hashtags.uses_count')
            ->orderBy('hashtags.slug')
            ->limit($limit)
            ->toBase()
            ->get()
            ->map(fn (object $row) => [
                'name' => (string) $row->name,
                'slug' => (string) $row->slug,
                'uses_count' => (int) $row->uses_count,
                'on_air' => (int) $row->on_air_count,
            ])
            ->values()
            ->all();
    }
}
