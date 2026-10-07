<?php

namespace App\Http\Middleware;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Stations\Support\StationPreferences;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A station may require two-factor authentication from its whole team: team
 * members without it are sent to set it up before entering the studio.
 */
class EnsureStationTwoFactor
{
    public function __construct(
        private readonly CurrentStation $current,
        private readonly StationPreferences $preferences,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user->hasTwoFactorEnabled() || ! $this->preferences->get($this->current->get(), 'security')['require_two_factor']) {
            return $next($request);
        }

        return redirect('/cuenta/seguridad')
            ->with('error', 'Esta emisora exige la verificación en dos pasos: actívala para entrar al estudio.');
    }
}
