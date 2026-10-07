<?php

namespace App\Domain\Payments;

use App\Domain\Payments\Actions\ClosePayment;
use App\Domain\Payments\Actions\ConfirmPayment;
use App\Domain\Payments\Enums\PaymentStatus;
use App\Models\Payment;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;
use UnexpectedValueException;

/**
 * Verifies and applies Stripe Checkout notifications. Stripe retries and may
 * repeat events; every outcome goes through idempotent actions, so a replay
 * never credits a wallet twice.
 */
final class StripeWebhook
{
    public function __construct(
        private readonly ConfirmPayment $confirm,
        private readonly ClosePayment $close,
    ) {}

    public static function isConfigured(): bool
    {
        return (string) config('services.stripe.webhook_secret') !== '';
    }

    /**
     * @throws SignatureVerificationException When the payload was not signed with our webhook secret.
     * @throws UnexpectedValueException When the payload is not a Stripe event.
     */
    public function handle(string $payload, string $signature): void
    {
        $event = Webhook::constructEvent($payload, $signature, (string) config('services.stripe.webhook_secret'));
        $session = $event->data->object->toArray();

        match ($event->type) {
            'checkout.session.completed' => ($session['payment_status'] ?? null) === 'paid' ? $this->paid($session) : null,
            'checkout.session.async_payment_succeeded' => $this->paid($session),
            'checkout.session.async_payment_failed' => $this->closed($session, PaymentStatus::Failed, 'El banco rechazó el pago.'),
            'checkout.session.expired' => $this->closed($session, PaymentStatus::Cancelled),
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $session
     */
    private function paid(array $session): void
    {
        $payment = $this->payment($session);
        if ($payment === null) {
            return;
        }

        $amountMatches = ($session['amount_total'] ?? null) === $payment->amount_cents
            && strtoupper((string) ($session['currency'] ?? '')) === $payment->currency;

        if (! $amountMatches) {
            Log::warning('Stripe checkout amount does not match the payment.', ['payment' => $payment->id, 'session' => $session['id'] ?? null]);

            return;
        }

        $this->confirm->handle($payment, [
            'checkout_session' => $session['id'] ?? null,
            'payment_intent' => is_string($session['payment_intent'] ?? null) ? $session['payment_intent'] : null,
        ]);
    }

    /**
     * @param  array<string, mixed>  $session
     */
    private function closed(array $session, PaymentStatus $status, ?string $reason = null): void
    {
        $payment = $this->payment($session);

        if ($payment !== null) {
            $this->close->handle($payment, $status, $reason);
        }
    }

    /**
     * @param  array<string, mixed>  $session
     */
    private function payment(array $session): ?Payment
    {
        $id = $session['metadata']['payment_id'] ?? $session['client_reference_id'] ?? null;

        if (! is_string($id) || ! Str::isUuid($id)) {
            return null;
        }

        return Payment::query()->where('provider', 'stripe')->find($id);
    }
}
