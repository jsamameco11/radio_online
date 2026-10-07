<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Enums\Permission;
use App\Domain\Stations\Actions\ReactivateStation;
use App\Domain\Stations\Actions\SuspendStation;
use App\Domain\Stations\Actions\UpdateStationDetails;
use App\Domain\Stations\Analytics\LocalTime;
use App\Domain\Stations\Analytics\StationAnalytics;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Stations\Enums\StationVisibility;
use App\Domain\Stations\Support\Locales;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SuspensionRequest;
use App\Http\Requests\Admin\UpdateStationRequest;
use App\Http\Resources\Admin\AuditLogResource;
use App\Http\Resources\Admin\ReportResource;
use App\Http\Resources\Admin\StationRowResource;
use App\Http\Resources\Stations\StationMemberResource;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Hashtag;
use App\Models\Report;
use App\Models\Station;
use App\Models\StationMember;
use App\Models\StationSetting;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Radios: every station of the platform, its detail and the staff actions on it. */
class StationController extends Controller
{
    private const SORTS = [
        'frecuencia' => ['frequencies.frequency', 'asc'],
        'oyentes' => ['stations.listener_count', 'desc'],
        'seguidores' => ['stations.follower_count', 'desc'],
        'recientes' => ['stations.created_at', 'desc'],
    ];

    public function index(Request $request): Response
    {
        $q = $request->string('q')->trim()->limit(80, '')->toString();
        $status = StationStatus::tryFrom($request->string('status')->toString());
        $stream = StreamStatus::tryFrom($request->string('stream')->toString());
        $category = $request->string('category')->toString();
        $sort = array_key_exists($request->string('sort')->toString(), self::SORTS) ? $request->string('sort')->toString() : 'frecuencia';
        [$column, $direction] = self::SORTS[$sort];

        $page = Station::query()
            ->select('stations.*')
            ->join('frequencies', 'frequencies.id', '=', 'stations.frequency_id')
            ->with(['frequency', 'owner'])
            ->when($q !== '', fn (Builder $query) => $query->where(fn (Builder $search) => $search
                ->where('stations.name', 'like', "%{$q}%")
                ->orWhere('frequencies.label', 'like', str_replace(',', '.', $q).'%')
                ->orWhereHas('owner', fn (Builder $owner) => $owner->where('email', 'like', "%{$q}%")->orWhere('name', 'like', "%{$q}%"))))
            ->when($status, fn (Builder $query, StationStatus $status) => $query->where('stations.status', $status->value))
            ->when($stream, fn (Builder $query, StreamStatus $stream) => $query->where('stations.stream_status', $stream->value))
            ->when($category !== '', fn (Builder $query) => $query->whereHas('categories', fn (Builder $categories) => $categories->where('slug', $category)))
            ->orderBy($column, $direction)
            ->paginate(25)
            ->withQueryString()
            ->through(fn (Station $station) => StationRowResource::make($station)->resolve($request));

        return Inertia::render('Admin/Stations/Index', [
            'stations' => $page,
            'filters' => ['q' => $q, 'status' => $status?->value ?? '', 'stream' => $stream?->value ?? '', 'category' => $category, 'sort' => $sort],
            'statuses' => collect(StationStatus::cases())->map(fn (StationStatus $item) => ['value' => $item->value, 'label' => $item->label()])->all(),
            'streams' => collect(StreamStatus::cases())->map(fn (StreamStatus $item) => ['value' => $item->value, 'label' => $item->label()])->all(),
            'categories' => Category::query()->active()->get(['id', 'name', 'slug'])->map(fn (Category $item) => ['value' => $item->slug, 'label' => $item->name])->all(),
        ]);
    }

    public function show(Request $request, Station $station, StationAnalytics $analytics): Response
    {
        $station->load(['frequency', 'owner', 'members.user', 'categories', 'hashtags', 'currentTopic.hashtags']);
        $user = $request->user();

        return Inertia::render('Admin/Stations/Show', [
            'station' => [
                ...StationRowResource::make($station)->resolve($request),
                'tagline' => $station->tagline,
                'description' => $station->description,
                'visibility' => $station->visibility->value,
                'visibility_label' => $station->visibility->label(),
                'language' => $station->language,
                'country' => $station->country,
                'categories' => $station->categories->map(fn (Category $category) => $category->name)->all(),
                'hashtags' => $station->hashtags->map(fn (Hashtag $tag) => $tag->name)->all(),
                'current_topic' => $station->currentTopic?->title,
                'latency_ms' => $station->latency_ms,
                'bitrate_kbps' => $station->bitrate_kbps,
                'went_live_at' => $station->went_live_at?->toIso8601String(),
            ],
            'team' => $station->members
                ->sortBy(fn (StationMember $member) => $member->role === StationRole::Owner ? 0 : 1)
                ->map(fn (StationMember $member) => StationMemberResource::make($member)->resolve($request))
                ->values()
                ->all(),
            'stats' => [
                ...$analytics->summary($station, LocalTime::startOfDay(29)),
                'gift_earnings_cents' => (int) $station->giftTransactions()->sum('station_amount_cents'),
                'gifts' => $station->giftTransactions()->count(),
            ],
            'settings' => StationSetting::query()
                ->where('station_id', $station->id)
                ->orderBy('key')
                ->get()
                ->map(fn (StationSetting $setting) => ['key' => $setting->key, 'value' => $setting->value, 'updated_at' => $setting->updated_at?->toIso8601String()])
                ->all(),
            'reports' => Report::query()
                ->where('reportable_type', $station->getMorphClass())
                ->where('reportable_id', (string) $station->id)
                ->with(['reporter', 'resolver'])
                ->latest()
                ->limit(10)
                ->get()
                ->map(fn (Report $report) => ReportResource::make($report->setRelation('reportable', $station))->resolve($request))
                ->all(),
            'broadcasts' => $analytics->recentBroadcasts($station),
            'audit' => $user->can(Permission::ViewAudit->value)
                ? AuditLog::query()
                    ->where('station_id', $station->id)
                    ->with(['actor', 'station.frequency'])
                    ->latest('created_at')
                    ->limit(15)
                    ->get()
                    ->map(fn (AuditLog $log) => AuditLogResource::make($log)->resolve($request))
                    ->all()
                : null,
            'options' => [
                'visibility' => collect(StationVisibility::cases())->map(fn (StationVisibility $item) => ['value' => $item->value, 'label' => $item->label()])->all(),
                'languages' => Locales::options(Locales::LANGUAGES),
                'countries' => Locales::options(Locales::COUNTRIES),
            ],
            'can' => [
                'update' => $user->can(Permission::UpdateStations->value) && ! $station->trashed(),
                'suspend' => $user->can(Permission::SuspendStations->value) && ! $station->trashed(),
                'enterStudio' => $user->can(Permission::EnterAnyStudio->value) && ! $station->trashed(),
            ],
        ]);
    }

    public function update(UpdateStationRequest $request, Station $station, UpdateStationDetails $update): RedirectResponse
    {
        $update->handle($station, $request->validated(), $request->user());

        return back()->with('success', 'Guardamos los datos de la emisora.');
    }

    public function suspend(SuspensionRequest $request, Station $station, SuspendStation $suspend): RedirectResponse
    {
        $suspend->handle($station, (string) $request->validated('reason'), $request->user());

        return back()->with('success', "Suspendiste {$station->name}.");
    }

    public function reactivate(Request $request, Station $station, ReactivateStation $reactivate): RedirectResponse
    {
        $reactivate->handle($station, null, $request->user());

        return back()->with('success', "{$station->name} volvió a la plataforma.");
    }
}
