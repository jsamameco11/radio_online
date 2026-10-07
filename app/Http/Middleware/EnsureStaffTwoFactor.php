<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The super admin panel requires a staff role and confirmed two-factor
 * authentication; staff without it are sent to set it up first.
 */
class EnsureStaffTwoFactor
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        abort_unless($user?->isStaff(), Response::HTTP_FORBIDDEN);

        if (! $user->hasTwoFactorEnabled()) {
            return redirect('/cuenta/seguridad')
                ->with('error', 'Activa la verificación en dos pasos para entrar al panel de administración.');
        }

        return $next($request);
    }
}
