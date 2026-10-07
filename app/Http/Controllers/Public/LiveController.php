<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Discovery\Queries\TrendingHashtags;
use App\Http\Controllers\Controller;
use App\Http\Resources\StationResource;
use App\Models\Station;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Every station sounding right now, hosts on the microphone first. */
class LiveController extends Controller
{
    public function __invoke(Request $request, StationDirectory $stations, TrendingHashtags $trending): Response
    {
        return Inertia::render('Public/Live', [
            'stations' => $stations->onAirQuery()
                ->paginate(24)
                ->through(fn (Station $station) => StationResource::make($station)->resolve($request)),
            'trending' => $trending->top(10),
        ]);
    }
}
