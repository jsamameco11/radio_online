<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Enums\Permission;
use App\Domain\Frequencies\Actions\ExpandDial;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Moderation\Enums\ReportStatus;
use App\Domain\Stations\Analytics\LocalTime;
use App\Domain\Stations\Analytics\PlatformAnalytics;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Domain\Streaming\Monitor\StreamMonitor;
use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\AuditLogResource;
use App\Http\Resources\Admin\StationRowResource;
use App\Models\AuditLog;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\Report;
use App\Models\Station;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The control panel home: platform figures, the last two weeks, what needs
 * attention now and the latest audited actions. Staff without access to the
 * dashboard (moderators) land on their first section instead.
 */
class DashboardController extends Controller
{
    private const FALLBACKS = [
        'streams.monitor' => 'admin.monitor',
        'moderation.manage' => 'admin.moderation.index',
        'stations.view' => 'admin.stations.index',
        'users.view' => 'admin.users.index',
    ];

    public function __invoke(Request $request, StreamMonitor $monitor, PlatformAnalytics $analytics): Response|RedirectResponse
    {
        $user = $request->user();

        if (! $user->can(Permission::ViewDashboard->value)) {
            foreach (self::FALLBACKS as $permission => $route) {
                if ($user->can($permission)) {
                    return redirect()->route($route);
                }
            }

            abort(403);
        }

        $frequencies = Frequency::query()->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $onAir = Station::query()->onAir();

        return Inertia::render('Admin/Dashboard', [
            'kpis' => [
                'stations' => Station::query()->count(),
                'stations_active' => Station::query()->where('status', StationStatus::Active->value)->count(),
                'stations_suspended' => Station::query()->where('status', StationStatus::Suspended->value)->count(),
                'on_air' => (clone $onAir)->count(),
                'live' => Station::query()->where('stream_status', StreamStatus::Live->value)->count(),
                'listeners_now' => (int) (clone $onAir)->sum('listener_count'),
                'users' => User::query()->count(),
                'users_this_week' => User::query()->where('created_at', '>=', LocalTime::startOfDay(6))->count(),
                'pending_requests' => FrequencyRequest::query()->where('status', FrequencyRequestStatus::Pending->value)->count(),
                'open_reports' => Report::query()->whereIn('status', [ReportStatus::Open->value, ReportStatus::Reviewing->value])->count(),
                'gifts_today' => $user->can(Permission::ViewPayments->value) ? $analytics->giftsSince(LocalTime::startOfDay()) : null,
            ],
            'dial' => [
                'total' => (int) $frequencies->sum(),
                'capacity' => ExpandDial::capacity(),
                'by_status' => collect(FrequencyStatus::cases())
                    ->map(fn (FrequencyStatus $status) => ['status' => $status->value, 'label' => $status->label(), 'total' => (int) ($frequencies[$status->value] ?? 0)])
                    ->all(),
            ],
            'series' => $analytics->daily(14),
            'topStations' => Station::query()
                ->onAir()
                ->with(['frequency', 'owner'])
                ->orderByDesc('listener_count')
                ->limit(6)
                ->get()
                ->map(fn (Station $station) => StationRowResource::make($station)->resolve($request))
                ->all(),
            'alerts' => [
                'troubled' => $monitor->troubled(8)
                    ->map(fn (Station $station) => [
                        'id' => $station->id,
                        'display_name' => $station->displayName(),
                        'slug' => $station->frequency->slug,
                        'stream_status' => $station->stream_status->value,
                        'stream_status_label' => $station->stream_status->label(),
                        'last_heartbeat_at' => $station->last_heartbeat_at?->toIso8601String(),
                    ])
                    ->all(),
                'maintenance' => (int) ($frequencies[FrequencyStatus::Maintenance->value] ?? 0),
                'stale_requests' => FrequencyRequest::query()
                    ->where('status', FrequencyRequestStatus::Pending->value)
                    ->where('created_at', '<', now()->subHours(48))
                    ->count(),
            ],
            'audit' => $user->can(Permission::ViewAudit->value)
                ? AuditLog::query()
                    ->with(['actor', 'station.frequency'])
                    ->latest('created_at')
                    ->latest('id')
                    ->limit(8)
                    ->get()
                    ->map(fn (AuditLog $log) => AuditLogResource::make($log)->resolve($request))
                    ->all()
                : null,
        ]);
    }
}
