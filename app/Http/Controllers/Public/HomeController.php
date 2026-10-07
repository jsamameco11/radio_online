<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\CategoryCatalog;
use App\Domain\Discovery\Queries\EpisodeCatalog;
use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Discovery\Queries\TrendingHashtags;
use App\Http\Controllers\Controller;
use App\Http\Resources\EpisodeResource;
use App\Http\Resources\StationResource;
use App\Models\Frequency;
use App\Models\Station;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(
        Request $request,
        StationDirectory $stations,
        TrendingHashtags $trending,
        CategoryCatalog $categories,
        EpisodeCatalog $episodes,
    ): Response {
        return Inertia::render('Public/Home', [
            'onAir' => StationResource::collection($stations->onAir(8))->resolve($request),
            'popular' => StationResource::collection($stations->popular(8))->resolve($request),
            'trending' => $trending->top(14),
            'categories' => $categories->featured(8),
            'episodes' => EpisodeResource::collection($episodes->query()->limit(6)->get())->resolve($request),
            'stats' => [
                'stations' => Station::query()->discoverable()->count(),
                'on_air' => Station::query()->discoverable()->onAir()->count(),
                'free_frequencies' => Frequency::query()->available()->count(),
            ],
        ]);
    }
}
