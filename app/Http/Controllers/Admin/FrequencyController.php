<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Enums\Permission;
use App\Domain\Frequencies\Actions\AssignFrequency;
use App\Domain\Frequencies\Actions\ReleaseFrequency;
use App\Domain\Frequencies\Actions\ReserveFrequency;
use App\Domain\Frequencies\Actions\SetFrequencyMaintenance;
use App\Domain\Frequencies\Actions\SetFrequencyPrice;
use App\Domain\Frequencies\DialMap;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Wallet\WalletLedger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AssignFrequencyRequest;
use App\Http\Requests\Admin\ReserveFrequencyRequest;
use App\Http\Requests\Admin\SetFrequencyPriceRequest;
use App\Http\Resources\Admin\AuditLogResource;
use App\Http\Resources\Admin\FrequencyRequestResource;
use App\Http\Resources\Admin\StationRowResource;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Frequency;
use App\Models\FrequencyListing;
use App\Models\FrequencyRequest;
use App\Models\Station;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Frecuencias: the dial, one frequency, and what the staff can do with it. */
class FrequencyController extends Controller
{
    public function index(Request $request, DialMap $dial): Response
    {
        $filters = [
            'status' => FrequencyStatus::tryFrom($request->string('status')->toString())?->value,
            'min' => is_numeric($request->query('min')) ? (float) $request->query('min') : null,
            'max' => is_numeric($request->query('max')) ? (float) $request->query('max') : null,
            'q' => $request->string('q')->trim()->limit(80, '')->toString() ?: null,
        ];

        $map = function () use (&$usage, $dial): array {
            return $usage ??= $dial->handle();
        };
        $unfiltered = array_filter($filters, fn (mixed $value) => $value !== null) === [];

        $page = Frequency::query()
            ->with(['station.owner'])
            ->when($filters['status'], fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($filters['min'], fn (Builder $query, float $min) => $query->where('frequency', '>=', $min))
            ->when($filters['max'], fn (Builder $query, float $max) => $query->where('frequency', '<=', $max))
            ->when($filters['q'], fn (Builder $query, string $q) => $query->where(fn (Builder $search) => $search
                ->where('label', 'like', str_replace(',', '.', $q).'%')
                ->orWhereHas('station', fn (Builder $station) => $station->where('name', 'like', "%{$q}%"))))
            ->onDial()
            ->paginate(50, total: $unfiltered ? fn () => array_sum($map()['totals']) : null)
            ->withQueryString()
            ->through(fn (Frequency $frequency) => [
                'id' => $frequency->id,
                'label' => $frequency->label,
                'slug' => $frequency->slug,
                'display' => $frequency->display(),
                'status' => $frequency->status->value,
                'status_label' => $frequency->status->label(),
                'price_cents' => $frequency->isPriced() ? $frequency->price_cents : null,
                'reserved_at' => $frequency->reserved_at?->toIso8601String(),
                'activated_at' => $frequency->activated_at?->toIso8601String(),
                'station' => $frequency->station === null ? null : [
                    'id' => $frequency->station->id,
                    'name' => $frequency->station->name,
                    'owner' => $frequency->station->owner->name,
                    'stream_status' => $frequency->station->stream_status->value,
                    'listeners' => $frequency->station->listener_count,
                    'rating_average' => round((float) $frequency->station->rating_average, 2),
                    'rating_count' => $frequency->station->rating_count,
                ],
            ]);

        return Inertia::render('Admin/Frequencies/Index', [
            'frequencies' => $page,
            'filters' => [
                'status' => $filters['status'] ?? '',
                'min' => $filters['min'] === null ? '' : number_format($filters['min'], 2, '.', ''),
                'max' => $filters['max'] === null ? '' : number_format($filters['max'], 2, '.', ''),
                'q' => $filters['q'] ?? '',
            ],
            'statuses' => fn () => collect(FrequencyStatus::cases())
                ->map(fn (FrequencyStatus $status) => ['value' => $status->value, 'label' => $status->label(), 'total' => $map()['totals'][$status->value]])
                ->all(),
            'dial' => fn () => $map()['segments'],
            'band' => ['min' => (float) config('platform.dial.min'), 'max' => (float) config('platform.dial.max')],
            'canExpand' => $request->user()->can(Permission::ManageSettings->value),
        ]);
    }

    public function show(Request $request, Frequency $frequency): Response
    {
        $station = $frequency->station()->with(['frequency', 'owner'])->first();
        $requests = FrequencyRequest::query()
            ->where('frequency_id', $frequency->id)
            ->with(['user', 'reviewer', 'frequency.station', 'station.frequency', 'payment'])
            ->latest()
            ->limit(20)
            ->get();
        FrequencyRequestResource::attachCategories($requests);

        return Inertia::render('Admin/Frequencies/Show', [
            'frequency' => [
                'id' => $frequency->id,
                'label' => $frequency->label,
                'slug' => $frequency->slug,
                'band' => $frequency->band,
                'display' => $frequency->display(),
                'mhz' => (float) $frequency->frequency,
                'status' => $frequency->status->value,
                'status_label' => $frequency->status->label(),
                'price_cents' => $frequency->isPriced() ? $frequency->price_cents : null,
                'reserved_at' => $frequency->reserved_at?->toIso8601String(),
                'activated_at' => $frequency->activated_at?->toIso8601String(),
                'created_at' => $frequency->created_at?->toIso8601String(),
            ],
            'onSale' => FrequencyListing::query()->active()->where('frequency_id', $frequency->id)->exists(),
            'pricing' => [
                'minPriceCents' => (int) config('platform.marketplace.min_price_cents'),
                'maxPriceCents' => (int) config('platform.marketplace.max_price_cents'),
                'processorFeePercent' => (int) config('platform.marketplace.processor_fee_percent'),
            ],
            'station' => $station === null ? null : StationRowResource::make($station)->resolve($request),
            'closedStations' => Station::onlyTrashed()
                ->where('frequency_id', $frequency->id)
                ->with(['frequency', 'owner'])
                ->latest('deleted_at')
                ->get()
                ->map(fn (Station $closed) => StationRowResource::make($closed)->resolve($request))
                ->all(),
            'requests' => $requests->map(fn (FrequencyRequest $item) => FrequencyRequestResource::make($item)->resolve($request))->all(),
            'history' => AuditLog::query()
                ->where('subject_type', $frequency->getMorphClass())
                ->where('subject_id', (string) $frequency->id)
                ->with(['actor', 'station.frequency'])
                ->latest('created_at')
                ->limit(20)
                ->get()
                ->map(fn (AuditLog $log) => AuditLogResource::make($log)->resolve($request))
                ->all(),
            'categories' => Category::query()
                ->active()
                ->get(['id', 'name', 'group'])
                ->map(fn (Category $category) => ['id' => $category->id, 'name' => $category->name, 'group' => $category->group->value, 'group_label' => $category->group->label()])
                ->all(),
            'maxCategories' => (int) config('platform.stations.max_categories'),
            'can' => [
                'assign' => $request->user()->can(Permission::AssignFrequencies->value),
                'release' => $request->user()->can(Permission::ReleaseFrequencies->value),
                'enterStudio' => $request->user()->can(Permission::EnterAnyStudio->value),
            ],
        ]);
    }

    public function reserve(ReserveFrequencyRequest $request, Frequency $frequency, ReserveFrequency $reserve): RedirectResponse
    {
        $frequency = $reserve->handle($frequency, $request->validated('note'), $request->user(), $request->priceCents());

        return back()->with('success', $frequency->isPriced()
            ? "Reservaste {$frequency->display()} por ".FrequencyListing::money($frequency->price_cents, WalletLedger::currency()).'. Ya se puede solicitar en “Obtén tu frecuencia”.'
            : "Reservaste la frecuencia {$frequency->display()}.");
    }

    public function price(SetFrequencyPriceRequest $request, Frequency $frequency, SetFrequencyPrice $price): RedirectResponse
    {
        $frequency = $price->handle($frequency, $request->priceCents(), $request->user());

        return back()->with('success', $frequency->isPriced()
            ? "{$frequency->display()} ahora cuesta ".FrequencyListing::money($frequency->price_cents, WalletLedger::currency()).'.'
            : "{$frequency->display()} ya no tiene precio: queda reservada y nadie puede solicitarla.");
    }

    public function assign(AssignFrequencyRequest $request, Frequency $frequency, AssignFrequency $assign): RedirectResponse
    {
        $station = $assign->handle($frequency, $request->owner(), (string) $request->validated('name'), $request->categoryIds(), $request->user());

        return redirect()->route('admin.stations.show', $station)->with('success', "{$station->displayName()} ya está en el dial.");
    }

    public function release(Request $request, Frequency $frequency, ReleaseFrequency $release): RedirectResponse
    {
        $release->handle($frequency, $request->user());

        return back()->with('success', "La frecuencia {$frequency->display()} quedó libre.");
    }

    public function maintenance(Request $request, Frequency $frequency, SetFrequencyMaintenance $maintenance): RedirectResponse
    {
        $on = $request->boolean('maintenance');
        $maintenance->handle($frequency, $on, $request->user());

        return back()->with('success', $on ? "La frecuencia {$frequency->display()} está en mantenimiento." : "La frecuencia {$frequency->display()} volvió al servicio.");
    }
}
