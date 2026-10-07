<?php

namespace App\Domain\Payments\Gateways;

use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Domain\Payments\PaymentGateway;
use App\Domain\Payments\Support\CheckoutSession;
use App\Models\Payment;
use Stripe\StripeClient;

/**
 * Stripe Checkout: the listener pays on a Stripe-hosted page; the session
 * carries our payment id in its metadata so the return page and the webhook
 * can both confirm it.
 */
final class StripeCheckoutGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'stripe';
    }

    public function isSandbox(): bool
    {
        return false;
    }

    public function checkout(Payment $payment): CheckoutSession
    {
        $payment->loadMissing('user');
        $returnUrl = rtrim((string) config('platform.urls.public'), '/').'/billetera/recarga/'.$payment->id;

        $session = $this->client()->checkout->sessions->create([
            'mode' => 'payment',
            'locale' => 'es',
            'client_reference_id' => $payment->id,
            'customer_email' => $payment->user->email,
            'line_items' => [[
                'quantity' => 1,
                'price_data' => [
                    'currency' => strtolower($payment->currency),
                    'unit_amount' => $payment->amount_cents,
                    'product_data' => ['name' => 'Recarga de billetera · '.config('platform.name')],
                ],
            ]],
            'metadata' => ['payment_id' => $payment->id],
            'payment_intent_data' => ['metadata' => ['payment_id' => $payment->id]],
            'success_url' => $returnUrl.'?session_id={CHECKOUT_SESSION_ID}',
            'cancel_url' => $returnUrl.'?cancelado=1',
        ], ['idempotency_key' => 'checkout-'.$payment->id]);

        return new CheckoutSession((string) $session->url, (string) $session->id);
    }

    public function status(Payment $payment): PaymentStatus
    {
        if ($payment->provider_reference === null) {
            return PaymentStatus::Pending;
        }

        $session = $this->client()->checkout->sessions->retrieve($payment->provider_reference);

        return match (true) {
            $session->payment_status === 'paid' => PaymentStatus::Succeeded,
            $session->status === 'expired' => PaymentStatus::Cancelled,
            default => PaymentStatus::Pending,
        };
    }

    public function refund(Payment $payment): string
    {
        $intent = $payment->meta['payment_intent']
            ?? $this->client()->checkout->sessions->retrieve((string) $payment->provider_reference)->payment_intent;

        $refund = $this->client()->refunds->create(
            ['payment_intent' => (string) $intent, 'metadata' => ['payment_id' => $payment->id]],
            ['idempotency_key' => 'refund-'.$payment->id],
        );

        return (string) $refund->id;
    }

    private function client(): StripeClient
    {
        $secret = config('services.stripe.secret');

        if (! is_string($secret) || $secret === '') {
            throw PaymentUnavailable::notConfigured();
        }

        return new StripeClient($secret);
    }
}
