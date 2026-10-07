<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\EpisodeCatalog;
use App\Domain\Discovery\Queries\StationDirectory;
use App\Http\Controllers\Controller;
use App\Http\Resources\EpisodeResource;
use App\Http\Resources\StationResource;
use App\Models\Hashtag;
use App\Models\Station;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Everything about a #hashtag: stations talking about it now, stations that carry it, and episodes. */
class HashtagController extends Controller
{
    public function __invoke(Request $request, Hashtag $hashtag, StationDirectory $stations, EpisodeCatalog $episodes): Response
    {
        $talkingNow = $stations->query()
            ->onAir()
            ->whereHas('currentTopic.hashtags', fn ($tag) => $tag->whereKey($hashtag->id))
            ->orderByDesc('listener_count')
            ->limit(12)
            ->get();

        $carrying = $stations->withHashtag($stations->query(), $hashtag->slug)
            ->orderByDesc('listener_count')
            ->orderByDesc('follower_count')
            ->paginate(24)
            ->through(fn (Station $station) => StationResource::make($station)->resolve($request));

        return Inertia::render('Public/Hashtag', [
            'hashtag' => ['name' => $hashtag->name, 'slug' => $hashtag->slug, 'uses_count' => $hashtag->uses_count],
            'talkingNow' => StationResource::collection($talkingNow)->resolve($request),
            'stations' => $carrying,
            'episodes' => EpisodeResource::collection($episodes->withHashtag($hashtag->slug)->limit(12)->get())->resolve($request),
        ]);
    }
}
