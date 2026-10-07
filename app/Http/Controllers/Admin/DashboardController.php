<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Enums\Permission;
use App\Domain\Frequencies\Actions\ExpandDial;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Stations\Analytics\PlatformAnalytics;
use App\Domain\Streaming\Monitor\StreamMonitor;
use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\AuditLogResource;
use App\Http\Resources\Admin\StationRowResource;
use App\Models\AuditLog;
use App\Models\Station;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The control panel home: platform figures, the last two weeks, what needs
 * attention now and the latest audited actions. Staff without access to the
 * dashboard (moderators) land on their first section instead.
 *
 * The figures arrive with the page (one query); the charts and the lists are
 * deferred in two groups the browser fetches in parallel.
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

        $overview = null;
        $figures = function () use (&$overview, $analytics): array {
            return $overview ??= $analytics->overview();
        };

        return Inertia::render('Admin/Dashboard', [
            'kpis' => fn () => [
                ...collect($figures())->except(['frequencies', 'stale_requests', 'gifts_today'])->all(),
                'gifts_today' => $user->can(Permission::ViewPayments->value) ? $figures()['gifts_today'] : null,
            ],
            'dial' => fn () => [
                'total' => array_sum($figures()['frequencies']),
                'capacity' => ExpandDial::capacity(),
                'by_status' => array_map(
                    fn (FrequencyStatus $status) => ['status' => $status->value, 'label' => $status->label(), 'total' => $figures()['frequencies'][$status->value]],
                    FrequencyStatus::cases(),
                ),
            ],
            'alerts' => fn () => [
                'maintenance' => $figures()['frequencies'][FrequencyStatus::Maintenance->value],
                'stale_requests' => $figures()['stale_requests'],
            ],
            'series' => Inertia::defer(fn () => $analytics->daily(14), 'charts'),
            'topStations' => Inertia::defer(fn () => Station::query()
                ->onAir()
                ->with(['frequency', 'owner'])
                ->orderByDesc('listener_count')
                ->limit(6)
                ->get()
                ->map(fn (Station $station) => StationRowResource::make($station)->resolve($request))
                ->all(), 'activity'),
            'troubled' => Inertia::defer(fn () => $monitor->troubled(8)
                ->map(fn (Station $station) => [
                    'id' => $station->id,
                    'display_name' => $station->displayName(),
                    'slug' => $station->frequency->slug,
                    'stream_status' => $station->stream_status->value,
                    'stream_status_label' => $station->stream_status->label(),
                    'last_heartbeat_at' => $station->last_heartbeat_at?->toIso8601String(),
                ])
                ->all(), 'activity'),
            'audit' => Inertia::defer(fn () => $user->can(Permission::ViewAudit->value)
                ? AuditLog::query()
                    ->with(['actor', 'station.frequency'])
                    ->latest('created_at')
                    ->latest('id')
                    ->limit(8)
                    ->get()
                    ->map(fn (AuditLog $log) => AuditLogResource::make($log)->resolve($request))
                    ->all()
                : null, 'activity'),
        ]);
    }
}
