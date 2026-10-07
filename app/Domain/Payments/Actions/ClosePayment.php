<?php

namespace App\Domain\Payments\Actions;

use App\Domain\Payments\Enums\PaymentStatus;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Marks a pending top-up as failed or cancelled. A payment that was already
 * credited is never touched.
 */
final class ClosePayment
{
    /**
     * @param  array<string, mixed>  $providerMeta
     */
    public function handle(Payment $payment, PaymentStatus $status, ?string $reason = null, array $providerMeta = []): Payment
    {
        if (! in_array($status, [PaymentStatus::Failed, PaymentStatus::Cancelled], true)) {
            throw new InvalidArgumentException('A payment can only be closed as failed or cancelled.');
        }

        $closed = DB::transaction(function () use ($payment, $status, $reason, $providerMeta) {
            $locked = Payment::query()->lockForUpdate()->findOrFail($payment->id);

            if ($locked->status === PaymentStatus::Pending) {
                $locked->forceFill([
                    'status' => $status,
                    'failure_reason' => $reason,
                    'meta' => [...$locked->meta ?? [], ...$providerMeta],
                ])->save();
            }

            return $locked;
        });

        $payment->setRawAttributes($closed->getAttributes(), true);

        return $closed;
    }
}
