<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Enums\Permission;
use App\Domain\Frequencies\Actions\ApproveFrequencyRequest;
use App\Domain\Frequencies\Actions\RejectFrequencyRequest;
use App\Domain\Frequencies\Actions\SettleFrequencyPayment;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ApproveFrequencyRequestRequest;
use App\Http\Requests\Admin\RejectFrequencyRequestRequest;
use App\Http\Requests\Admin\SettleFrequencyPaymentRequest;
use App\Http\Resources\Admin\FrequencyRequestResource;
use App\Models\Frequency;
use App\Models\FrequencyPayment;
use App\Models\FrequencyRequest;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Solicitudes: frequency requests waiting for review or payment, and the decided ones. */
class FrequencyRequestController extends Controller
{
    private const TABS = [
        'pending' => [FrequencyRequestStatus::Pending],
        'payment' => [FrequencyRequestStatus::AwaitingPayment],
        'approved' => [FrequencyRequestStatus::Approved],
        'rejected' => [FrequencyRequestStatus::Rejected, FrequencyRequestStatus::Cancelled],
    ];

    public function index(Request $request): Response
    {
        $tab = array_key_exists($request->string('tab')->toString(), self::TABS) ? $request->string('tab')->toString() : 'pending';
        $kind = FrequencyRequestKind::tryFrom($request->string('kind')->toString());

        $page = FrequencyRequest::query()
            ->whereIn('status', array_map(fn (FrequencyRequestStatus $status) => $status->value, self::TABS[$tab]))
            ->when($kind, fn (Builder $query, FrequencyRequestKind $kind) => $query->where('kind', $kind->value))
            ->with(['user', 'reviewer', 'frequency.station', 'station.frequency', 'payment'])
            ->orderBy($tab === 'pending' ? 'created_at' : 'reviewed_at', $tab === 'pending' ? 'asc' : 'desc')
            ->paginate(20)
            ->withQueryString();

        FrequencyRequestResource::attachCategories($page->getCollection());
        $page->through(fn (FrequencyRequest $item) => FrequencyRequestResource::make($item)->resolve($request));

        $counts = FrequencyRequest::query()->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return Inertia::render('Admin/Requests/Index', [
            'requests' => $page,
            'tab' => $tab,
            'kind' => $kind?->value ?? '',
            'counts' => collect(self::TABS)
                ->map(fn (array $statuses) => (int) collect($statuses)->sum(fn (FrequencyRequestStatus $status) => $counts[$status->value] ?? 0))
                ->all(),
            'kinds' => collect(FrequencyRequestKind::cases())->map(fn (FrequencyRequestKind $item) => ['value' => $item->value, 'label' => $item->label()])->all(),
            'freeFrequencies' => in_array($tab, ['pending', 'payment'], true) ? Frequency::freeOptions() : [],
            'canSettlePayments' => $request->user()->can(Permission::ManagePayouts->value),
        ]);
    }

    public function approve(ApproveFrequencyRequestRequest $request, FrequencyRequest $frequencyRequest, ApproveFrequencyRequest $approve): RedirectResponse
    {
        $station = $approve->handle(
            $frequencyRequest,
            $request->user(),
            $request->filled('frequency') ? $request->alternative() : null,
            $request->validated('note'),
        );

        if ($station === null) {
            $payment = FrequencyPayment::query()->where('frequency_request_id', $frequencyRequest->id)->firstOrFail();

            return back()->with('error', "El banco rechazó el cobro de {$payment->cardLabel()}: {$payment->failure_reason} Le avisamos para que pague con otra tarjeta; la radio se abrirá apenas lo haga.");
        }

        return back()->with('success', "Solicitud aprobada: {$station->displayName()}.");
    }

    public function reject(RejectFrequencyRequestRequest $request, FrequencyRequest $frequencyRequest, RejectFrequencyRequest $reject): RedirectResponse
    {
        $reject->handle($frequencyRequest, $request->user(), (string) $request->validated('note'));

        return back()->with('success', 'Solicitud rechazada. Le avisamos a quien la envió.');
    }

    /** A charge the processor never confirmed, settled by hand after checking the processor's panel. */
    public function settle(SettleFrequencyPaymentRequest $request, FrequencyRequest $frequencyRequest, SettleFrequencyPayment $settle): RedirectResponse
    {
        $station = $settle->handle($frequencyRequest, $request->user(), $request->boolean('charged'), $request->validated('reference'));

        return back()->with('success', $station === null
            ? 'Registramos que el cobro no se realizó: se puede volver a cobrar.'
            : "Pago confirmado: {$station->displayName()} ya está en el dial.");
    }
}
