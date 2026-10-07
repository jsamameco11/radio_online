<?php

namespace App\Domain\Payments\Actions;

use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Payments\PaymentGateways;
use App\Models\Payment;
use Stripe\Exception\ApiErrorException;

/**
 * Runs when the listener comes back from the checkout: asks the provider how
 * the payment went and confirms or closes it. If the provider cannot answer
 * the payment stays pending and the webhook settles it.
 */
final class SyncPayment
{
    public function __construct(
        private readonly PaymentGateways $gateways,
        private readonly ConfirmPayment $confirm,
        private readonly ClosePayment $close,
    ) {}

    public function handle(Payment $payment, bool $abandoned = false): Payment
    {
        if ($payment->status !== PaymentStatus::Pending) {
            return $payment;
        }

        try {
            $status = $this->gateways->for($payment)->status($payment);
        } catch (ApiErrorException $exception) {
            report($exception);
            $status = PaymentStatus::Pending;
        }

        return match ($status) {
            PaymentStatus::Succeeded => $this->confirm->handle($payment),
            PaymentStatus::Failed => $this->close->handle($payment, PaymentStatus::Failed, 'El pago fue rechazado.'),
            PaymentStatus::Cancelled => $this->close->handle($payment, PaymentStatus::Cancelled),
            default => $abandoned ? $this->close->handle($payment, PaymentStatus::Cancelled) : $payment,
        };
    }
}
