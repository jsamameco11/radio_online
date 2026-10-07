<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Platform\PlatformHost;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\StationLinks;
use App\Http\Controllers\Controller;
use App\Http\Resources\StationResource;
use App\Models\Station;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Landing of the creators' console: a team member with a single station goes
 * straight to its studio, otherwise they pick which one to open.
 */
class StudioHomeController extends Controller
{
    public function __invoke(Request $request): RedirectResponse|Response
    {
        $user = $request->user();
        $stations = $user->stations()->with(['frequency', 'categories'])->orderBy('name')->get();

        if (! $user->isStaff() && $stations->count() === 1) {
            return redirect()->route('studio.dashboard', ['studio' => $stations->first()->frequency->slug]);
        }

        return Inertia::render('Studio/ChooseStation', [
            'stations' => $stations->map(fn (Station $station) => [
                'station' => StationResource::make($station)->resolve($request),
                'role' => StationRole::from($station->pivot->role)->label(),
                'listen_url' => StationLinks::listen($station),
            ])->values()->all(),
            'adminUrl' => $user->isStaff() ? PlatformHost::Control->url('/admin') : null,
            'createUrl' => PlatformHost::Public->url('/crear-mi-radio'),
        ]);
    }
}
