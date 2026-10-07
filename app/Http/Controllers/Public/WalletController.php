<?php

namespace App\Http\Controllers\Public;

use App\Domain\Payments\PaymentGateways;
use App\Domain\Wallet\WalletLedger;
use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Http\Resources\WalletTransactionResource;
use App\Models\WalletTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** /billetera: the listener's balance, top-up options, history and payments. */
class WalletController extends Controller
{
    public function show(Request $request, WalletLedger $ledger, PaymentGateways $gateways): Response
    {
        $user = $request->user();
        $wallet = $ledger->open($user);

        return Inertia::render('Wallet/Show', [
            'wallet' => ['balance_cents' => $wallet->balance_cents, 'currency' => $wallet->currency],
            'topUp' => [
                'presets' => config('platform.wallet.deposit_presets_cents'),
                'min_cents' => (int) config('platform.wallet.min_deposit_cents'),
                'max_cents' => (int) config('platform.wallet.max_deposit_cents'),
                'sandbox' => $gateways->default()->isSandbox(),
            ],
            'transactions' => $wallet->transactions()
                ->paginate(15)
                ->withQueryString()
                ->through(fn (WalletTransaction $transaction) => WalletTransactionResource::make($transaction)->resolve($request)),
            'payments' => PaymentResource::collection($user->payments()->latest()->limit(10)->get())->resolve($request),
        ]);
    }

    /** GET /billetera/saldo: the header chip refreshes from here. */
    public function balance(Request $request, WalletLedger $ledger): JsonResponse
    {
        return response()->json([
            'balance_cents' => $ledger->balance($request->user()),
            'currency' => WalletLedger::currency(),
        ]);
    }
}
