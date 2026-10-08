<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Integrity\Exceptions\FollowLimitReached;
use App\Domain\Integrity\Support\RequestSignals;
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
        try {
            $follow->handle($request->user(), $station, RequestSignals::from($request)->network);
        } catch (FollowLimitReached $limit) {
            return back()->with('error', $limit->getMessage());
        }

        return back()->with('success', "Te suscribiste a {$station->displayName()}.");
    }

    public function destroy(Request $request, Frequency $frequency, StationDirectory $stations, UnfollowStation $unfollow): RedirectResponse
    {
        $station = $stations->onFrequencyOrFail($frequency);
        $unfollow->handle($request->user(), $station);

        return back()->with('success', "Cancelaste tu suscripción a {$station->displayName()}.");
    }
}
