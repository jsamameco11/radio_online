<?php

namespace App\Http\Controllers\Public;

use App\Domain\Payments\Actions\StartTopUp;
use App\Domain\Payments\Actions\SyncPayment;
use App\Domain\Wallet\WalletLedger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Wallet\TopUpRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/** Wallet top-ups: start a checkout, then show how it went when the listener comes back. */
class TopUpController extends Controller
{
    public function store(TopUpRequest $request, StartTopUp $start): SymfonyResponse
    {
        $payment = $start->handle($request->user(), $request->integer('amount_cents'));

        return Inertia::location((string) $payment->checkout_url);
    }

    public function show(Request $request, Payment $payment, SyncPayment $sync, WalletLedger $ledger): Response
    {
        Gate::authorize('view', $payment);

        if ($payment->user_id === $request->user()->id) {
            $payment = $sync->handle($payment, $request->boolean('cancelado'));
        }

        return Inertia::render('Wallet/TopUp', [
            'payment' => PaymentResource::make($payment)->resolve($request),
            'balance_cents' => $ledger->balance($request->user()),
            'sandbox' => $payment->provider === 'sandbox',
        ]);
    }
}
