<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Monetization\Actions\MarkWithdrawalPaid;
use App\Domain\Monetization\Actions\RejectWithdrawal;
use App\Domain\Monetization\Enums\WithdrawalStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MarkWithdrawalPaidRequest;
use App\Http\Requests\Admin\ReviewNoteRequest;
use App\Http\Resources\WithdrawalRequestResource;
use App\Models\WithdrawalRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Retiros: station withdrawals to pay (or reject, giving the money back). */
class WithdrawalController extends Controller
{
    public function index(Request $request): Response
    {
        $tab = WithdrawalStatus::tryFrom($request->string('tab')->toString()) ?? WithdrawalStatus::Pending;
        $pending = $tab === WithdrawalStatus::Pending;

        $totals = WithdrawalRequest::acrossStations()->toBase()
            ->selectRaw('status, count(*) as total, coalesce(sum(amount_cents), 0) as amount')
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        return Inertia::render('Admin/Withdrawals/Index', [
            'tab' => $tab->value,
            'totals' => collect(WithdrawalStatus::cases())->mapWithKeys(fn (WithdrawalStatus $status) => [$status->value => [
                'count' => (int) ($totals[$status->value]->total ?? 0),
                'amount_cents' => (int) ($totals[$status->value]->amount ?? 0),
            ]])->all(),
            'withdrawals' => WithdrawalRequest::acrossStations()
                ->where('status', $tab->value)
                ->with(['station.frequency', 'requester', 'reviewer'])
                ->orderBy($pending ? 'created_at' : 'reviewed_at', $pending ? 'asc' : 'desc')
                ->paginate(20)
                ->withQueryString()
                ->through(fn (WithdrawalRequest $withdrawal) => WithdrawalRequestResource::make($withdrawal)->resolve($request)),
        ]);
    }

    public function pay(MarkWithdrawalPaidRequest $request, WithdrawalRequest $withdrawalRequest, MarkWithdrawalPaid $pay): RedirectResponse
    {
        $paid = $pay->handle($withdrawalRequest, $request->user(), trim((string) $request->validated('reference')), $request->validated('note') ?: null);

        return back()->with('success', "Retiro de {$paid->formattedAmount()} marcado como pagado.");
    }

    public function reject(ReviewNoteRequest $request, WithdrawalRequest $withdrawalRequest, RejectWithdrawal $reject): RedirectResponse
    {
        $rejected = $reject->handle($withdrawalRequest, $request->user(), (string) $request->validated('note'));

        return back()->with('success', "Retiro rechazado: devolvimos {$rejected->formattedAmount()} a la radio.");
    }
}
