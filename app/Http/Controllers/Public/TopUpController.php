<?php

namespace App\Http\Controllers\Public;

use App\Domain\Payments\Actions\ChargePayment;
use App\Domain\Payments\Actions\StartTopUp;
use App\Domain\Payments\PaymentGateways;
use App\Domain\Wallet\WalletLedger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Wallet\ChargeTopUpRequest;
use App\Http\Requests\Wallet\TopUpRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/** Wallet top-ups: open one, pay it on its page with the provider's checkout, see how it went. */
class TopUpController extends Controller
{
    public function store(TopUpRequest $request, StartTopUp $start): RedirectResponse
    {
        $payment = $start->handle($request->user(), $request->integer('amount_cents'));

        return to_route('wallet.topup.show', $payment);
    }

    public function show(Request $request, Payment $payment, PaymentGateways $gateways, WalletLedger $ledger): Response
    {
        Gate::authorize('view', $payment);

        $payable = $request->user()->can('pay', $payment) && ChargePayment::isChargeable($payment);

        return Inertia::render('Wallet/TopUp', [
            'payment' => PaymentResource::make($payment)->resolve($request),
            'balance_cents' => $ledger->balance($request->user()),
            'sandbox' => $gateways->for($payment)->isSandbox(),
            'checkout' => $payable ? [
                ...$gateways->for($payment)->checkout($payment),
                'driver' => $payment->provider,
                'email' => $request->user()->email,
                'charge_url' => route('wallet.topup.charge', $payment, absolute: false),
            ] : null,
        ]);
    }

    /** POST /billetera/recarga/{payment}/cargo: the checkout's token, charged for the payment's own amount. */
    public function charge(ChargeTopUpRequest $request, Payment $payment, ChargePayment $charge, WalletLedger $ledger): JsonResponse
    {
        $payment = $charge->handle($payment, $request->attempt());

        return response()->json([
            'payment' => PaymentResource::make($payment)->resolve($request),
            'balance_cents' => $ledger->balance($request->user()),
        ]);
    }
}
