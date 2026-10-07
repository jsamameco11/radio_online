<?php

namespace App\Http\Controllers\Control;

use App\Domain\Platform\PlatformHost;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** /estudio/89-30/biblioteca on the control host → /89-30/biblioteca on the creators' console. */
class MovedStudioController extends Controller
{
    public function __invoke(Request $request, ?string $path = null): RedirectResponse
    {
        $query = $request->getQueryString();

        return redirect()->away(PlatformHost::Studio->url($path ?? '/').($query === null ? '' : '?'.$query), 301);
    }
}
