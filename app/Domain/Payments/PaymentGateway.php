<?php

namespace App\Domain\Payments;

use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Payments\Support\CheckoutSession;
use App\Models\Payment;

/**
 * A provider that charges wallet top-ups. The platform never sees card data:
 * the listener pays on the provider's checkout page and comes back to
 * /billetera/recarga/{payment}; the provider also notifies us by webhook.
 */
interface PaymentGateway
{
    /** Name stored in payments.provider: "stripe", "sandbox". */
    public function name(): string;

    /** True for the test gateway, so every screen can say "modo de prueba". */
    public function isSandbox(): bool;

    /** Opens the provider's checkout for a pending payment. */
    public function checkout(Payment $payment): CheckoutSession;

    /** Asks the provider how the payment went: succeeded, pending, failed or cancelled. */
    public function status(Payment $payment): PaymentStatus;

    /** Gives the money back to the payer and returns the provider's refund reference. */
    public function refund(Payment $payment): string;
}
