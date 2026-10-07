<?php

namespace App\Http\Middleware;

use App\Domain\Access\Enums\Permission;
use App\Domain\Platform\PlatformHost;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The console host is for creators: members of a station team, and staff
 * allowed to supervise any studio. Everyone else is invited to create a radio
 * on the public platform.
 */
class EnsureStudioAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || $user->memberships()->exists() || $user->can(Permission::EnterAnyStudio->value)) {
            return $next($request);
        }

        return redirect()->away(PlatformHost::Public->url('/crear-mi-radio'));
    }
}
