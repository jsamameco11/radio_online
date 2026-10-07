<?php

namespace App\Domain\Payments\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Domain\Payments\PaymentGateways;
use App\Domain\Wallet\Exceptions\InvalidAmount;
use App\Domain\Wallet\WalletLedger;
use App\Models\Payment;
use App\Models\User;
use Stripe\Exception\ApiErrorException;

/**
 * Creates a pending top-up and opens the provider's checkout for it. The
 * wallet is credited later, by ConfirmPayment, once the provider says paid.
 */
final class StartTopUp
{
    public function __construct(
        private readonly PaymentGateways $gateways,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(User $user, int $amountCents): Payment
    {
        if ($user->isSuspended()) {
            throw PaymentUnavailable::accountSuspended();
        }

        $min = (int) config('platform.wallet.min_deposit_cents');
        $max = (int) config('platform.wallet.max_deposit_cents');

        if ($amountCents < $min || $amountCents > $max) {
            throw InvalidAmount::depositOutOfRange($min, $max);
        }

        $gateway = $this->gateways->default();

        $payment = Payment::query()->create([
            'user_id' => $user->id,
            'provider' => $gateway->name(),
            'amount_cents' => $amountCents,
            'currency' => WalletLedger::currency(),
            'status' => PaymentStatus::Pending,
        ]);

        try {
            $session = $gateway->checkout($payment);
        } catch (PaymentUnavailable $exception) {
            $this->markFailed($payment, $exception->getMessage());

            throw $exception;
        } catch (ApiErrorException $exception) {
            report($exception);
            $this->markFailed($payment, 'La pasarela de pago rechazó la solicitud.');

            throw PaymentUnavailable::providerError();
        }

        $payment->forceFill(['provider_reference' => $session->reference, 'checkout_url' => $session->url])->save();

        $this->audit->record('payment.started', $payment, [
            'amount_cents' => $amountCents,
            'provider' => $gateway->name(),
        ], $user);

        return $payment;
    }

    private function markFailed(Payment $payment, string $reason): void
    {
        $payment->forceFill(['status' => PaymentStatus::Failed, 'failure_reason' => $reason])->save();
    }
}
