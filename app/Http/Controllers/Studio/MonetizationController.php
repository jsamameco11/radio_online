<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Monetization\Actions\RequestMonetization;
use App\Domain\Monetization\Enums\MonetizationRequestStatus;
use App\Domain\Monetization\Enums\PayoutMethod;
use App\Domain\Monetization\Enums\WithdrawalStatus;
use App\Domain\Monetization\MonetizationEligibility;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Wallet\WalletLedger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Monetization\RequestMonetizationRequest;
use App\Http\Resources\MonetizationRequestResource;
use App\Http\Resources\WithdrawalRequestResource;
use App\Models\MonetizationRequest;
use App\Models\WithdrawalRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Estudio > Monetización: the station's earnings, ready to withdraw from day
 * one, and its road to becoming a "Radio monetizada".
 */
class MonetizationController extends Controller
{
    public function index(Request $request, CurrentStation $current, MonetizationEligibility $eligibility, WalletLedger $ledger): Response
    {
        $station = $current->get();
        $wallet = $ledger->open($station);
        $evaluation = $eligibility->evaluate($station);
        $latest = MonetizationRequest::query()->with('reviewer')->latest('id')->first();
        $retryAt = RequestMonetization::retryAt($latest);

        $status = match (true) {
            $station->isMonetized() => 'monetized',
            $latest?->status === MonetizationRequestStatus::Pending => 'pending',
            $retryAt !== null => 'rejected',
            $evaluation->eligible() => 'eligible',
            default => 'in_progress',
        };

        return Inertia::render('Studio/Monetization', [
            'status' => $status,
            'monetization' => [...$evaluation->toArray(), 'monetized_at' => $station->monetized_at?->toIso8601String()],
            'request' => $latest === null ? null : MonetizationRequestResource::make($latest)->resolve($request),
            'retryAt' => $retryAt?->toIso8601String(),
            'wallet' => ['balance_cents' => $wallet->balance_cents, 'currency' => $wallet->currency],
            'withdrawals' => WithdrawalRequest::query()
                ->latest('id')
                ->paginate(10)
                ->withQueryString()
                ->through(fn (WithdrawalRequest $withdrawal) => WithdrawalRequestResource::make($withdrawal)->resolve($request)),
            'withdrawalInProcess' => WithdrawalRequest::query()->where('status', WithdrawalStatus::Pending->value)->exists(),
            'minWithdrawalCents' => (int) config('platform.monetization.min_withdrawal_cents'),
            'methods' => PayoutMethod::options(),
            'canAct' => $request->user()->canInStation($station, StationPermission::WithdrawEarnings),
        ]);
    }

    public function store(RequestMonetizationRequest $request, CurrentStation $current, RequestMonetization $action): RedirectResponse
    {
        $action->handle($current->get(), $request->user());

        return back()->with('success', '¡Enviamos tu solicitud! Te avisaremos apenas la revisemos.');
    }
}
