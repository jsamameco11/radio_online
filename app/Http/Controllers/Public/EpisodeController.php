<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\EpisodeCatalog;
use App\Domain\Discovery\Queries\StationDirectory;
use App\Http\Controllers\Controller;
use App\Http\Resources\EpisodeResource;
use App\Models\Frequency;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** A published episode of a station: /radio/89-30/episodios/{uuid}. */
class EpisodeController extends Controller
{
    public function show(Request $request, Frequency $frequency, string $episode, StationDirectory $stations, EpisodeCatalog $episodes): Response
    {
        $station = $stations->onFrequencyOrFail($frequency);
        $current = $episodes->ofStation($station)->whereKey($episode)->firstOrFail();
        $more = $episodes->ofStation($station)->whereKeyNot($current->id)->limit(8)->get();

        return Inertia::render('Public/Episode', [
            ...StationController::context($request->user(), $station),
            'episode' => EpisodeResource::make($current)->resolve($request),
            'more' => EpisodeResource::collection($more)->resolve($request),
        ]);
    }
}
