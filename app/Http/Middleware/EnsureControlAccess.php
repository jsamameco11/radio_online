<?php

namespace App\Http\Middleware;

use App\Domain\Platform\PlatformHost;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The control host is only for the platform staff. Creators are sent to
 * their console and listeners back to the public platform.
 */
class EnsureControlAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || $user->isStaff()) {
            return $next($request);
        }

        return redirect()->away($user->hasStudio()
            ? PlatformHost::Studio->url()
            : PlatformHost::Public->url('/crear-mi-radio'));
    }
}
