<?php

namespace App\Domain\Payments\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Domain\Payments\PaymentGateways;
use App\Domain\Wallet\Exceptions\InvalidAmount;
use App\Domain\Wallet\WalletLedger;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Opens a pending top-up the listener then pays from the top-up page. A
 * double click, or coming back to pay the same amount, reuses the open
 * top-up that was never charged instead of piling up new ones.
 */
final class StartTopUp
{
    private const REUSE_MINUTES = 30;

    public function __construct(
        private readonly PaymentGateways $gateways,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(User $user, int $amountCents): Payment
    {
        if ($user->isSuspended()) {
            throw PaymentUnavailable::accountSuspended();
        }

        $min = (int) config('platform.wallet.min_deposit_cents');
        $max = (int) config('platform.wallet.max_deposit_cents');

        if ($amountCents < $min || $amountCents > $max) {
            throw InvalidAmount::depositOutOfRange($min, $max);
        }

        $gateway = $this->gateways->default();
        $gateway->ensureAvailable();

        return DB::transaction(function () use ($user, $amountCents, $gateway) {
            User::query()->whereKey($user->id)->lockForUpdate()->first();

            $open = $user->payments()
                ->where('status', PaymentStatus::Pending->value)
                ->where('provider', $gateway->name())
                ->where('amount_cents', $amountCents)
                ->where('created_at', '>=', now()->subMinutes(self::REUSE_MINUTES))
                ->latest()
                ->get()
                ->first(fn (Payment $payment) => ! isset($payment->meta[ChargePayment::ATTEMPT]));

            if ($open !== null) {
                return $open;
            }

            $payment = Payment::query()->create([
                'user_id' => $user->id,
                'provider' => $gateway->name(),
                'amount_cents' => $amountCents,
                'currency' => WalletLedger::currency(),
                'status' => PaymentStatus::Pending,
            ]);

            $this->audit->record('payment.started', $payment, [
                'amount_cents' => $amountCents,
                'provider' => $gateway->name(),
            ], $user);

            return $payment;
        });
    }
}
