<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Stations\Actions\FollowStation;
use App\Domain\Stations\Actions\UnfollowStation;
use App\Http\Controllers\Controller;
use App\Models\Frequency;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class FollowController extends Controller
{
    public function store(Request $request, Frequency $frequency, StationDirectory $stations, FollowStation $follow): RedirectResponse
    {
        $station = $stations->onFrequencyOrFail($frequency);
        $follow->handle($request->user(), $station);

        return back()->with('success', "Ahora sigues {$station->displayName()}.");
    }

    public function destroy(Request $request, Frequency $frequency, StationDirectory $stations, UnfollowStation $unfollow): RedirectResponse
    {
        $station = $stations->onFrequencyOrFail($frequency);
        $unfollow->handle($request->user(), $station);

        return back()->with('success', "Dejaste de seguir {$station->displayName()}.");
    }
}
