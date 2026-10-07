<?php

namespace App\Domain\Payments\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Payments\Exceptions\PaymentNotRefundable;
use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Domain\Payments\PaymentGateways;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Stripe\Exception\ApiErrorException;

/**
 * Returns a top-up to the card it came from. The deposited amount is taken
 * back out of the listener's wallet first, so money already spent on gifts
 * cannot be refunded; if the provider refuses, nothing changes.
 */
final class RefundPayment
{
    public function __construct(
        private readonly WalletLedger $ledger,
        private readonly PaymentGateways $gateways,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(Payment $payment, User $actor, string $reason): Payment
    {
        return DB::transaction(function () use ($payment, $actor, $reason) {
            $locked = Payment::query()->with('user')->lockForUpdate()->findOrFail($payment->id);

            if ($locked->status !== PaymentStatus::Succeeded) {
                throw new PaymentNotRefundable;
            }

            $debit = $this->ledger->refund($this->ledger->open($locked->user), $locked->amount_cents, new LedgerEntry(
                'payment-refund:'.$locked->id,
                'Reembolso de recarga',
                source: $locked,
                actor: $actor,
                meta: ['reason' => $reason],
            ));

            try {
                $reference = $this->gateways->for($locked)->refund($locked);
            } catch (ApiErrorException $exception) {
                report($exception);

                throw PaymentUnavailable::providerError();
            }

            $locked->forceFill([
                'status' => PaymentStatus::Refunded,
                'meta' => [...$locked->meta ?? [], 'refund_reference' => $reference, 'refund_reason' => $reason, 'refund_transaction_id' => $debit->id],
            ])->save();

            $this->audit->record('payment.refunded', $locked, [
                'amount_cents' => $locked->amount_cents,
                'reason' => $reason,
                'refund_reference' => $reference,
            ], $actor);

            return $locked;
        });
    }
}
