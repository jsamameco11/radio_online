<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** /crear-mi-radio?frecuencia=89-30 → /obten-tu-frecuencia?frecuencia=89-30. */
class MovedApplicationController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        return redirect()->route('site.station-requests.create', $request->query(), 301);
    }
}
