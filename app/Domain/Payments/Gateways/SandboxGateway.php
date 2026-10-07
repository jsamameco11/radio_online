<?php

namespace App\Domain\Payments\Gateways;

use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Domain\Payments\PaymentGateway;
use App\Domain\Payments\Support\CheckoutSession;
use App\Models\Payment;
use Illuminate\Support\Str;

/**
 * Test gateway for development: no card is charged and every top-up is
 * approved as soon as the listener lands on the return page. It refuses to
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

    public function checkout(Payment $payment): CheckoutSession
    {
        $this->ensureAllowed();

        return new CheckoutSession(
            rtrim((string) config('platform.urls.public'), '/').'/billetera/recarga/'.$payment->id,
            'sandbox_'.$payment->id,
        );
    }

    public function status(Payment $payment): PaymentStatus
    {
        $this->ensureAllowed();

        return PaymentStatus::Succeeded;
    }

    public function refund(Payment $payment): string
    {
        $this->ensureAllowed();

        return 'sandbox_refund_'.Str::lower(Str::random(16));
    }

    private function ensureAllowed(): void
    {
        if (app()->isProduction()) {
            throw PaymentUnavailable::sandboxInProduction();
        }
    }
}
