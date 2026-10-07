<?php

namespace App\Http\Middleware;

use App\Domain\Access\Enums\Permission;
use App\Domain\Stations\Support\CurrentStation;
use App\Models\Station;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Opens the studio of the station in the URL (/estudio/89-30/…): only its
 * team, or staff allowed to enter any studio, get in. The station becomes the
 * current station of the request and the route parameter is removed, so
 * studio controllers never receive it.
 */
class ResolveStudioStation
{
    public function __construct(private readonly CurrentStation $current) {}

    public function handle(Request $request, Closure $next): Response
    {
        $slug = (string) $request->route('studio');

        $station = Station::query()
            ->whereHas('frequency', fn ($query) => $query->where('slug', $slug))
            ->with('frequency')
            ->firstOrFail();

        $user = $request->user();
        $member = $user->roleIn($station) !== null;

        abort_unless($member || $user->can(Permission::EnterAnyStudio->value), Response::HTTP_FORBIDDEN);

        $this->current->set($station);
        $request->route()->forgetParameter('studio');

        return $next($request);
    }
}
