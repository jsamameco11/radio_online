<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Growth\GrowthProgram;
use App\Domain\Stations\Analytics\LocalTime;
use App\Domain\Stations\Analytics\StationAnalytics;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Stations\Support\StationLinks;
use App\Http\Controllers\Controller;
use App\Models\FrequencyRequest;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio > Resumen: how the station is doing and what is left to set up. */
class StationDashboardController extends Controller
{
    public function __invoke(Request $request, CurrentStation $current, StationAnalytics $analytics, GrowthProgram $growth): Response
    {
        $station = $current->get()->loadMissing(['frequency', 'categories', 'hashtags']);
        $station->loadCount('members');
        $user = $request->user();
        $canAnalytics = $user->canInStation($station, StationPermission::ViewAnalytics);
        $week = LocalTime::startOfDay(6);

        $pendingChange = FrequencyRequest::query()
            ->where('station_id', $station->id)
            ->where('kind', FrequencyRequestKind::FrequencyChange->value)
            ->where('status', FrequencyRequestStatus::Pending->value)
            ->with('frequency')
            ->first();

        return Inertia::render('Studio/Dashboard', [
            'summary' => $canAnalytics ? $analytics->summary($station, $week) : null,
            'daily' => $canAnalytics ? $analytics->daily($station, $week) : null,
            'broadcasts' => $canAnalytics ? $analytics->recentBroadcasts($station, 5) : null,
            'growth' => $canAnalytics ? $growth->summary($station) : null,
            'monetized' => $station->isMonetized(),
            'role' => $user->roleIn($station)?->label(),
            'teamSize' => (int) $station->members_count,
            'listenUrl' => StationLinks::listen($station),
            'pendingChange' => $pendingChange === null ? null : [
                'frequency' => $pendingChange->frequency->display(),
                'created_at' => $pendingChange->created_at->toIso8601String(),
            ],
            'checklist' => [
                ['key' => 'logo', 'label' => 'Sube el logo de tu radio', 'done' => $station->logo_path !== null, 'href' => '/perfil', 'permission' => StationPermission::EditProfile->value],
                ['key' => 'description', 'label' => 'Cuenta de qué trata tu radio', 'done' => filled($station->description), 'href' => '/perfil', 'permission' => StationPermission::EditProfile->value],
                ['key' => 'categories', 'label' => 'Elige las categorías de tu radio', 'done' => $station->categories->isNotEmpty(), 'href' => '/perfil', 'permission' => StationPermission::EditProfile->value],
                ['key' => 'hashtags', 'label' => 'Agrega hashtags para que te encuentren', 'done' => $station->hashtags->isNotEmpty(), 'href' => '/perfil', 'permission' => StationPermission::EditProfile->value],
                ['key' => 'team', 'label' => 'Invita a tu equipo', 'done' => $station->members_count > 1, 'href' => '/configuracion/equipo', 'permission' => StationPermission::ManageMembers->value],
            ],
        ]);
    }
}
