<?php

namespace App\Domain\Payments;

use App\Domain\Payments\Gateways\SandboxGateway;
use App\Domain\Payments\Gateways\StripeCheckoutGateway;
use App\Models\Payment;
use Illuminate\Contracts\Container\Container;
use InvalidArgumentException;

/**
 * Picks the gateway: new top-ups use config('platform.payments.driver'); an
 * existing payment always goes back to the provider that charged it.
 */
final class PaymentGateways
{
    public function __construct(private readonly Container $container) {}

    public function default(): PaymentGateway
    {
        return $this->named((string) config('platform.payments.driver'));
    }

    public function for(Payment $payment): PaymentGateway
    {
        return $this->named($payment->provider);
    }

    public function named(string $name): PaymentGateway
    {
        return match ($name) {
            'stripe' => $this->container->make(StripeCheckoutGateway::class),
            'sandbox' => $this->container->make(SandboxGateway::class),
            default => throw new InvalidArgumentException("Unknown payment gateway [{$name}]."),
        };
    }
}
