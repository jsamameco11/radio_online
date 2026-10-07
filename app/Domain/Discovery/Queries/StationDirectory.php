<?php

namespace App\Domain\Discovery\Queries;

use App\Domain\Discovery\Enums\StationSort;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Models\Frequency;
use App\Models\Station;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * Stations as listeners find them: only active public stations, with what
 * App\Http\Resources\StationResource reads already loaded.
 */
final class StationDirectory
{
    /** Relations every public listing serializes. */
    public const RELATIONS = ['frequency', 'categories', 'hashtags', 'currentTopic.hashtags'];

    /** @return Builder<Station> */
    public function query(): Builder
    {
        return Station::query()->discoverable()->with(self::RELATIONS);
    }

    /** @return LengthAwarePaginator<int, Station> */
    public function search(StationFilters $filters, int $perPage = 24): LengthAwarePaginator
    {
        $query = $this->query();

        if ($filters->text !== null && $filters->text !== '') {
            $this->matchText($query, $filters->text);
        }
        if ($filters->category !== null) {
            $query->whereHas('categories', fn (Builder $category) => $category->where('slug', $filters->category));
        }
        if ($filters->hashtag !== null) {
            $this->withHashtag($query, $filters->hashtag);
        }
        if ($filters->onAirOnly) {
            $query->onAir();
        }

        return $this->sort($query, $filters->sort)->paginate($perPage)->withQueryString();
    }

    /**
     * Stations sounding right now, hosts on the microphone first.
     *
     * @return Collection<int, Station>
     */
    public function onAir(int $limit): Collection
    {
        return $this->onAirQuery()->limit($limit)->get();
    }

    /** @return Builder<Station> */
    public function onAirQuery(): Builder
    {
        return $this->query()
            ->onAir()
            ->orderByRaw('case when stream_status = ? then 0 else 1 end', [StreamStatus::Live->value])
            ->orderByDesc('listener_count')
            ->orderBy('id');
    }

    /** @return Collection<int, Station> */
    public function popular(int $limit): Collection
    {
        return $this->sort($this->query(), StationSort::Followers)->limit($limit)->get();
    }

    /**
     * Stations that carry the hashtag permanently or in the topic on air now.
     *
     * @param  Builder<Station>  $query
     * @return Builder<Station>
     */
    public function withHashtag(Builder $query, string $slug): Builder
    {
        return $query->where(fn (Builder $either) => $either
            ->whereHas('hashtags', fn (Builder $tag) => $tag->where('slug', $slug))
            ->orWhereHas('currentTopic.hashtags', fn (Builder $tag) => $tag->where('slug', $slug)));
    }

    /**
     * The station broadcasting on a frequency, also when it is only shared by link.
     */
    public function onFrequency(Frequency $frequency): ?Station
    {
        return $this->activeOn($frequency)->first();
    }

    /**
     * @throws ModelNotFoundException<Station>
     */
    public function onFrequencyOrFail(Frequency $frequency): Station
    {
        return $this->activeOn($frequency)->firstOrFail();
    }

    /** @return Builder<Station> */
    private function activeOn(Frequency $frequency): Builder
    {
        return Station::query()
            ->where('frequency_id', $frequency->id)
            ->where('status', StationStatus::Active->value)
            ->with(self::RELATIONS);
    }

    /**
     * @param  Builder<Station>  $query
     * @return Builder<Station>
     */
    public function sort(Builder $query, StationSort $sort): Builder
    {
        $sorted = match ($sort) {
            StationSort::Listeners => $query->orderByDesc('listener_count')->orderByDesc('follower_count'),
            StationSort::Followers => $query->orderByDesc('follower_count')->orderByDesc('listener_count'),
            StationSort::Newest => $query->latest('created_at'),
        };

        return $sorted->orderBy('stations.id');
    }

    /** @param  Builder<Station>  $query */
    private function matchText(Builder $query, string $text): void
    {
        $like = '%'.$text.'%';

        $query->where(fn (Builder $any) => $any
            ->where('name', 'like', $like)
            ->orWhere('tagline', 'like', $like)
            ->orWhereHas('categories', fn (Builder $category) => $category->where('name', 'like', $like))
            ->orWhereHas('hashtags', fn (Builder $tag) => $tag->where('name', 'like', $like))
            ->orWhereHas('currentTopic', fn (Builder $topic) => $topic->where('title', 'like', $like)));
    }
}
