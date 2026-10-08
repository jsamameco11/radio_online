<?php

namespace App\Domain\Payments;

use App\Domain\Payments\Gateways\CulqiGateway;
use App\Domain\Payments\Gateways\SandboxGateway;
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

    /** Cards on file go through the same providers as top-ups. */
    public function cards(?string $name = null): CardGateway
    {
        $gateway = $this->named($name ?? (string) config('platform.payments.driver'));

        if (! $gateway instanceof CardGateway) {
            throw new InvalidArgumentException("Payment gateway [{$gateway->name()}] cannot keep cards on file.");
        }

        return $gateway;
    }

    public function named(string $name): PaymentGateway
    {
        return match ($name) {
            'culqi' => $this->container->make(CulqiGateway::class),
            'sandbox' => $this->container->make(SandboxGateway::class),
            default => throw new InvalidArgumentException("Unknown payment gateway [{$name}]."),
        };
    }
}
