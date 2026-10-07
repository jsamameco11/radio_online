<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Stations\Enums\StationStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\StationResource;
use App\Models\Station;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** "Mis radios": the stations the listener follows, those on air first. */
class FollowingController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $followed = $request->user()
            ->follows()
            ->where('stations.status', StationStatus::Active->value)
            ->with(StationDirectory::RELATIONS)
            ->orderByPivot('created_at', 'desc')
            ->paginate(24);

        return Inertia::render('Public/Following', [
            'stations' => $followed->through(fn (Station $station) => StationResource::make($station)->resolve($request)),
        ]);
    }
}
