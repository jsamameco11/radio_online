<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Monetization\Actions\ApproveMonetization;
use App\Domain\Monetization\Actions\RejectMonetization;
use App\Domain\Monetization\Enums\MonetizationRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ApproveMonetizationRequest;
use App\Http\Requests\Admin\ReviewNoteRequest;
use App\Http\Resources\MonetizationRequestResource;
use App\Models\MonetizationRequest;
use App\Models\Station;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Monetización: stations asking to become a "Radio monetizada". */
class MonetizationRequestController extends Controller
{
    public function index(Request $request): Response
    {
        $tab = MonetizationRequestStatus::tryFrom($request->string('tab')->toString()) ?? MonetizationRequestStatus::Pending;
        $pending = $tab === MonetizationRequestStatus::Pending;

        $counts = MonetizationRequest::acrossStations()->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return Inertia::render('Admin/Monetization/Index', [
            'tab' => $tab->value,
            'counts' => collect(MonetizationRequestStatus::cases())->mapWithKeys(fn (MonetizationRequestStatus $status) => [$status->value => (int) ($counts[$status->value] ?? 0)])->all(),
            'monetizedStations' => Station::query()->whereNotNull('monetized_at')->count(),
            'requests' => MonetizationRequest::acrossStations()
                ->where('status', $tab->value)
                ->with(['station.frequency', 'station.owner', 'requester', 'reviewer'])
                ->orderBy($pending ? 'created_at' : 'reviewed_at', $pending ? 'asc' : 'desc')
                ->paginate(20)
                ->withQueryString()
                ->through(fn (MonetizationRequest $item) => MonetizationRequestResource::make($item)->resolve($request)),
        ]);
    }

    public function approve(ApproveMonetizationRequest $request, MonetizationRequest $monetizationRequest, ApproveMonetization $approve): RedirectResponse
    {
        $approved = $approve->handle($monetizationRequest, $request->user(), $request->validated('note') ?: null);

        return back()->with('success', "{$approved->station->displayName()} ahora es Radio monetizada.");
    }

    public function reject(ReviewNoteRequest $request, MonetizationRequest $monetizationRequest, RejectMonetization $reject): RedirectResponse
    {
        $reject->handle($monetizationRequest, $request->user(), (string) $request->validated('note'));

        return back()->with('success', 'Solicitud rechazada. Le avisamos al propietario de la radio.');
    }
}
