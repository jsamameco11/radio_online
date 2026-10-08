<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Stations\Actions\RateStation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\RateStationRequest;
use App\Models\Frequency;
use Illuminate\Http\RedirectResponse;

/** A listener's star rating of the station on a frequency. */
class StationRatingController extends Controller
{
    public function store(RateStationRequest $request, Frequency $frequency, StationDirectory $stations, RateStation $rate): RedirectResponse
    {
        $station = $stations->onFrequencyOrFail($frequency);
        $stars = (int) $request->validated('stars');
        $rate->handle($request->user(), $station, $stars);

        return back()->with('success', 'Guardamos tu calificación de '.$stars.($stars === 1 ? ' estrella.' : ' estrellas.'));
    }
}
