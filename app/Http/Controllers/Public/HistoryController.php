<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Stations\Enums\StationStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Site\ListeningResource;
use App\Models\ListenerSession;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** What the listener tuned in to, most recent first. */
class HistoryController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $sessions = $request->user()
            ->listenerSessions()
            ->whereHas('station', fn (Builder $station) => $station->where('status', StationStatus::Active->value))
            ->with(array_map(fn (string $relation) => "station.{$relation}", StationDirectory::RELATIONS))
            ->latest('started_at')
            ->latest('id')
            ->paginate(30);

        return Inertia::render('Public/History', [
            'sessions' => $sessions->through(fn (ListenerSession $session) => ListeningResource::make($session)->resolve($request)),
            'totals' => [
                'seconds' => (int) $request->user()->listenerSessions()->sum('seconds'),
                'stations' => $request->user()->listenerSessions()->distinct()->count('station_id'),
            ],
        ]);
    }
}
