<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The control host is only for the platform staff and station teams.
 * Listeners are sent back to the public platform.
 */
class EnsureControlAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || $user->isStaff() || $user->memberships()->exists()) {
            return $next($request);
        }

        return redirect()->away(rtrim((string) config('platform.urls.public'), '/').'/crear-mi-radio');
    }
}
