<?php

namespace App\Http\Controllers\Control;

use App\Http\Controllers\Controller;
use App\Http\Resources\StationResource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Landing of the control host: staff go to the platform panel, a station
 * team with a single station straight to its studio, otherwise it picks one.
 */
class ControlHomeController extends Controller
{
    public function __invoke(Request $request): RedirectResponse|Response
    {
        $user = $request->user();
        $stations = $user->stations()->with(['frequency', 'categories'])->orderBy('name')->get();

        if ($user->isStaff() && $stations->isEmpty()) {
            return redirect()->route('admin.dashboard');
        }

        if (! $user->isStaff() && $stations->count() === 1) {
            return redirect()->route('studio.dashboard', ['studio' => $stations->first()->frequency->slug]);
        }

        return Inertia::render('Control/ChooseStation', [
            'stations' => StationResource::collection($stations)->resolve($request),
            'canOpenAdmin' => $user->isStaff(),
        ]);
    }
}
