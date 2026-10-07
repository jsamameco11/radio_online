<?php

namespace App\Http\Middleware;

use App\Domain\Access\Enums\Permission;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route middleware "studio.can:library.manage,episodes.manage": the user needs
 * any of the listed permissions in the current station. Staff who may enter
 * any studio pass every check.
 */
class EnsureStudioPermission
{
    public function __construct(private readonly CurrentStation $current) {}

    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();
        $station = $this->current->get();

        $allowed = $user->can(Permission::EnterAnyStudio->value)
            || collect($permissions)->contains(fn (string $permission) => $user->canInStation($station, StationPermission::from($permission)));

        abort_unless($allowed, Response::HTTP_FORBIDDEN);

        return $next($request);
    }
}
