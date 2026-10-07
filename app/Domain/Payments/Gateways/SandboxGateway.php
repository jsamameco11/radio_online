<?php

namespace App\Domain\Payments\Gateways;

use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Domain\Payments\PaymentGateway;
use App\Domain\Payments\Support\ChargeAttempt;
use App\Domain\Payments\Support\ChargeResult;
use App\Models\Payment;
use Illuminate\Support\Str;

/**
 * Test gateway for development: the top-up page offers a "simular pago"
 * button instead of a card form and every charge is approved. It refuses to
 * work in production.
 */
final class SandboxGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'sandbox';
    }

    public function isSandbox(): bool
    {
        return true;
    }

    public function ensureAvailable(): void
    {
        if (app()->isProduction()) {
            throw PaymentUnavailable::sandboxInProduction();
        }
    }

    public function checkout(Payment $payment): array
    {
        $this->ensureAvailable();

        return [
            'amount_cents' => $payment->amount_cents,
            'currency' => $payment->currency,
        ];
    }

    public function charge(Payment $payment, ChargeAttempt $attempt): ChargeResult
    {
        $this->ensureAvailable();

        return ChargeResult::succeeded('sandbox_'.$payment->id);
    }

    public function refund(Payment $payment, string $reason): string
    {
        $this->ensureAvailable();

        return 'sandbox_refund_'.Str::lower(Str::random(16));
    }
}
