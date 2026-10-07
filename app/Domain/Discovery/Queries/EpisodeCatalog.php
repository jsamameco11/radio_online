<?php

namespace App\Domain\Discovery\Queries;

use App\Models\Episode;
use App\Models\Station;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Published episodes listeners can play on demand, newest first, with what
 * App\Http\Resources\EpisodeResource reads already loaded.
 */
final class EpisodeCatalog
{
    public const RELATIONS = ['track', 'hashtags', 'station.frequency'];

    /**
     * Episodes of every public station.
     *
     * @return Builder<Episode>
     */
    public function query(): Builder
    {
        return Episode::query()
            ->published()
            ->whereHas('station', fn (Builder $station) => $station->discoverable())
            ->with(self::RELATIONS)
            ->latest('published_at')
            ->orderByDesc('aired_on');
    }

    /** @return HasMany<Episode, Station> */
    public function ofStation(Station $station): HasMany
    {
        return $station->episodes()
            ->published()
            ->with(['track', 'hashtags'])
            ->latest('published_at')
            ->orderByDesc('aired_on');
    }

    /** @return Builder<Episode> */
    public function withHashtag(string $slug): Builder
    {
        return $this->query()->whereHas('hashtags', fn (Builder $tag) => $tag->where('slug', $slug));
    }
}
