<?php

namespace App\Domain\Payments\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

/**
 * Credits the wallet for a payment the provider reported as paid.
 *
 * The return page and the webhook may both call it, in any order and more
 * than once: the payment row is locked and the deposit uses the payment id
 * as its idempotency key, so the money is credited exactly once.
 */
final class ConfirmPayment
{
    public function __construct(
        private readonly WalletLedger $ledger,
        private readonly AuditTrail $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $providerMeta
     */
    public function handle(Payment $payment, array $providerMeta = []): Payment
    {
        $confirmed = DB::transaction(function () use ($payment, $providerMeta) {
            $locked = Payment::query()->with('user')->lockForUpdate()->findOrFail($payment->id);

            if (in_array($locked->status, [PaymentStatus::Succeeded, PaymentStatus::Refunded], true)) {
                return $locked;
            }

            $deposit = $this->ledger->deposit($this->ledger->open($locked->user), $locked->amount_cents, new LedgerEntry(
                'payment:'.$locked->id,
                'Recarga de saldo',
                source: $locked,
                actor: $locked->user,
                meta: ['provider' => $locked->provider],
            ));

            $locked->forceFill([
                'status' => PaymentStatus::Succeeded,
                'paid_at' => now(),
                'wallet_transaction_id' => $deposit->id,
                'failure_reason' => null,
                'meta' => array_filter([...$locked->meta ?? [], ...$providerMeta], fn ($value) => $value !== null),
            ])->save();

            $this->audit->record('wallet.deposited', $locked, [
                'amount_cents' => $locked->amount_cents,
                'provider' => $locked->provider,
                'wallet_transaction_id' => $deposit->id,
            ], $locked->user);

            return $locked;
        }, 3);

        $payment->setRawAttributes($confirmed->getAttributes(), true);

        return $confirmed;
    }
}
