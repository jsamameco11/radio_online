<?php

namespace App\Domain\Payments\Actions;

use App\Domain\Payments\Enums\ChargeStatus;
use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Payments\Exceptions\AuthenticationRequired;
use App\Domain\Payments\Exceptions\ChargePending;
use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Domain\Payments\PaymentGateways;
use App\Domain\Payments\Support\ChargeAttempt;
use App\Models\Payment;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;

/**
 * Charges a pending top-up with the token from the provider's checkout.
 *
 * Only one charge per payment runs at a time, and a payment that already
 * went to the provider takes no other card: a replayed or doubled request
 * gets the current state back and the wallet is credited at most once.
 * The amount is always the payment's own, never the browser's.
 */
final class ChargePayment
{
    /** Key in payments.meta recording that the card was sent to the provider. */
    public const ATTEMPT = 'charge_attempt';

    private const SENT = 'sent';

    private const AWAITING_AUTHENTICATION = 'authentication_required';

    private const LOCK_SECONDS = 60;

    private const WAIT_SECONDS = 15;

    public function __construct(
        private readonly PaymentGateways $gateways,
        private readonly ConfirmPayment $confirm,
        private readonly ClosePayment $close,
    ) {}

    /** True while the payment can still take a card: pending and never charged, or waiting for 3-D Secure. */
    public static function isChargeable(Payment $payment): bool
    {
        return $payment->status === PaymentStatus::Pending
            && in_array($payment->meta[self::ATTEMPT] ?? null, [null, self::AWAITING_AUTHENTICATION], true);
    }

    public function handle(Payment $payment, ChargeAttempt $attempt): Payment
    {
        try {
            return Cache::lock('payment-charge:'.$payment->id, self::LOCK_SECONDS)
                ->block(self::WAIT_SECONDS, fn () => $this->charge($payment->refresh(), $attempt));
        } catch (LockTimeoutException) {
            throw ChargePending::inProgress();
        }
    }

    private function charge(Payment $payment, ChargeAttempt $attempt): Payment
    {
        if ($payment->status !== PaymentStatus::Pending) {
            return $payment;
        }

        if (! self::isChargeable($payment)) {
            throw ChargePending::unconfirmed();
        }

        $this->markAttempt($payment, self::SENT);

        try {
            $result = $this->gateways->for($payment)->charge($payment, $attempt);
        } catch (PaymentUnavailable $exception) {
            $this->close->handle($payment, PaymentStatus::Failed, $exception->getMessage());

            throw $exception;
        }

        return match ($result->status) {
            ChargeStatus::Succeeded => $this->confirm->handle($payment, $result->meta, $result->reference),
            ChargeStatus::Declined => $this->close->handle($payment, PaymentStatus::Failed, $result->message, $result->meta),
            ChargeStatus::RequiresAuthentication => $this->awaitAuthentication($payment, $result->message),
        };
    }

    private function awaitAuthentication(Payment $payment, ?string $message): never
    {
        $this->markAttempt($payment, self::AWAITING_AUTHENTICATION);

        throw new AuthenticationRequired($message);
    }

    private function markAttempt(Payment $payment, string $state): void
    {
        $payment->forceFill(['meta' => [...$payment->meta ?? [], self::ATTEMPT => $state]])->save();
    }
}
