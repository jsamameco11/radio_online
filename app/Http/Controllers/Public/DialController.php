<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\StationDirectory;
use App\Http\Controllers\Controller;
use App\Http\Resources\StationResource;
use App\Models\Frequency;
use App\Models\Station;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** The whole FM band with every public station on its frequency, to tune like a real radio. */
class DialController extends Controller
{
    public function __invoke(Request $request, StationDirectory $stations): Response
    {
        $onDial = $stations->query()
            ->get()
            ->sortBy(fn (Station $station) => (float) $station->frequency->frequency)
            ->values();

        return Inertia::render('Public/Dial', [
            'stations' => StationResource::collection($onDial)->resolve($request),
            'band' => [
                'name' => config('platform.dial.band'),
                'min' => (float) config('platform.dial.min'),
                'max' => (float) config('platform.dial.max'),
            ],
            'counts' => [
                'frequencies' => Frequency::query()->count(),
                'available' => Frequency::query()->available()->count(),
                'on_air' => $onDial->filter(fn (Station $station) => $station->isOnAir())->count(),
            ],
        ]);
    }
}
