<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Growth\GrowthProgram;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Stations\Support\StationLinks;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio > Metas y crecimiento: streak, goals, tips and the road to monetization. */
class GrowthController extends Controller
{
    public function __invoke(Request $request, CurrentStation $current, GrowthProgram $program): Response
    {
        $station = $current->get()->loadMissing('frequency');

        return Inertia::render('Studio/Growth', [
            'growth' => $program->snapshot($station),
            'shareUrl' => StationLinks::listen($station),
            'canMonetize' => $request->user()->canInStation($station, StationPermission::WithdrawEarnings),
            'minWithdrawalCents' => (int) config('platform.monetization.min_withdrawal_cents'),
        ]);
    }
}
