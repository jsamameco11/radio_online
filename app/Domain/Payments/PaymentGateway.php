<?php

namespace App\Domain\Payments;

use App\Domain\Payments\Exceptions\ChargePending;
use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Domain\Payments\Support\ChargeAttempt;
use App\Domain\Payments\Support\ChargeResult;
use App\Models\Payment;

/**
 * A provider that charges wallet top-ups. The platform never sees card data:
 * the provider's checkout turns the card into a single-use token in the
 * browser and the backend charges that token for the amount of the payment.
 */
interface PaymentGateway
{
    /** Name stored in payments.provider: "culqi", "sandbox". */
    public function name(): string;

    /** True for the test gateway, so every screen can say "modo de prueba". */
    public function isSandbox(): bool;

    /**
     * @throws PaymentUnavailable when the gateway cannot take payments now
     */
    public function ensureAvailable(): void;

    /**
     * Public settings the top-up page needs to open the checkout. Never secrets.
     *
     * @return array<string, mixed>
     */
    public function checkout(Payment $payment): array;

    /**
     * Charges the token for exactly the payment's amount and currency.
     *
     * @throws PaymentUnavailable when nothing was charged because the gateway is misconfigured
     * @throws ChargePending when the provider's answer was lost and the card may have been charged
     */
    public function charge(Payment $payment, ChargeAttempt $attempt): ChargeResult;

    /**
     * Gives the whole payment back to the card and returns the provider's refund reference.
     *
     * @throws PaymentUnavailable when the provider refuses or cannot be reached
     */
    public function refund(Payment $payment, string $reason): string;
}
