<?php

namespace App\Domain\Frequencies;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyPaymentStatus;
use App\Domain\Payments\Enums\ChargeStatus;
use App\Domain\Payments\Exceptions\ChargePending;
use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Domain\Payments\PaymentGateways;
use App\Domain\Payments\Support\CardCharge;
use App\Domain\Payments\Support\ChargeAttempt;
use App\Domain\Payments\Support\ChargeResult;
use App\Models\FrequencyPayment;
use App\Models\User;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/**
 * Charges the price of a priced frequency: the card on file when the staff
 * approves, or a new card the applicant enters after a decline.
 *
 * One charge per payment runs at a time. The payment is marked unconfirmed
 * before the processor is called, so a timeout never lets anyone charge it
 * again blindly: the staff settles it by hand after checking the processor.
 */
final class FrequencyCharges
{
    private const LOCK_SECONDS = 60;

    private const WAIT_SECONDS = 15;

    public function __construct(
        private readonly PaymentGateways $gateways,
        private readonly AuditTrail $audit,
    ) {}

    /** Merchant-initiated: nobody is there to answer 3-D Secure, so a challenge counts as a decline. */
    public function chargeSavedCard(FrequencyPayment $payment, User $reviewer): ChargeResult
    {
        return $this->run($payment, [FrequencyPaymentStatus::CardSaved], $reviewer, fn (FrequencyPayment $payment) => $payment->card_id === null
            ? throw ValidationException::withMessages(['request' => 'La persona aún no registró su tarjeta.'])
            : $this->charge($payment, $payment->card_id), authenticate: false);
    }

    /** The applicant pays with a new card after the one on file was declined. */
    public function chargeToken(FrequencyPayment $payment, ChargeAttempt $attempt, User $payer): ChargeResult
    {
        return $this->run($payment, [FrequencyPaymentStatus::Failed], $payer, fn (FrequencyPayment $payment) => $this->charge(
            $payment,
            $attempt->token,
            $attempt->email,
            $attempt->authentication3ds,
        ), authenticate: true);
    }

    /**
     * @param  list<FrequencyPaymentStatus>  $chargeable
     * @param  callable(FrequencyPayment): CardCharge  $build
     */
    private function run(FrequencyPayment $payment, array $chargeable, User $actor, callable $build, bool $authenticate): ChargeResult
    {
        try {
            return Cache::lock('frequency-payment:'.$payment->id, self::LOCK_SECONDS)
                ->block(self::WAIT_SECONDS, function () use ($payment, $chargeable, $actor, $build, $authenticate) {
                    $payment->refresh();

                    if ($payment->status === FrequencyPaymentStatus::Paid) {
                        return ChargeResult::succeeded((string) $payment->charge_reference);
                    }

                    if (! in_array($payment->status, $chargeable, true)) {
                        throw ValidationException::withMessages(['request' => match ($payment->status) {
                            FrequencyPaymentStatus::CardRequired => 'La persona aún no registró su tarjeta.',
                            FrequencyPaymentStatus::Unconfirmed => 'Hay un cobro sin confirmar. Revísalo en la pasarela y resuélvelo antes de volver a cobrar.',
                            FrequencyPaymentStatus::Cancelled => 'Este pago fue cancelado.',
                            default => 'Este pago no se puede cobrar ahora.',
                        }]);
                    }

                    return $this->attempt($payment, $build($payment), $actor, $authenticate);
                });
        } catch (LockTimeoutException) {
            throw ChargePending::inProgress();
        }
    }

    private function attempt(FrequencyPayment $payment, CardCharge $charge, User $actor, bool $authenticate): ChargeResult
    {
        $previous = $payment->status;
        $payment->forceFill(['status' => FrequencyPaymentStatus::Unconfirmed, 'attempts' => $payment->attempts + 1])->save();

        try {
            $result = $this->gateways->cards($payment->provider)->chargeCard($charge);
        } catch (PaymentUnavailable $exception) {
            $payment->forceFill(['status' => $previous])->save();

            throw $exception;
        } catch (ChargePending $exception) {
            $this->audit->record('frequency_payment.unconfirmed', $payment->request()->firstOrFail(), ['payment_id' => $payment->id], $actor);

            throw $exception;
        }

        if ($result->status === ChargeStatus::RequiresAuthentication && $authenticate) {
            $payment->forceFill(['status' => $previous])->save();

            return $result;
        }

        $card = array_filter([
            'card_brand' => $result->meta['card_brand'] ?? null,
            'card_last_four' => $result->meta['card_last_four'] ?? null,
        ], fn ($value) => is_string($value) && $value !== '');
        $meta = [...$payment->meta ?? [], 'last_charge' => $result->meta];

        if ($result->status === ChargeStatus::Succeeded) {
            $payment->forceFill([
                ...$card,
                'status' => FrequencyPaymentStatus::Paid,
                'charge_reference' => $result->reference,
                'charged_at' => now(),
                'failure_reason' => null,
                'meta' => $meta,
            ])->save();

            $this->audit->record('frequency_payment.paid', $payment->request()->firstOrFail(), [
                'payment_id' => $payment->id,
                'amount_cents' => $payment->amount_cents,
                'reference' => $result->reference,
            ], $actor);

            return $result;
        }

        $reason = $result->status === ChargeStatus::RequiresAuthentication
            ? 'Tu banco pide confirmar la compra con una verificación (3-D Secure). Complétala pagando desde tu solicitud.'
            : ($result->message ?: 'Tu banco rechazó el cargo. No se cobró nada.');

        $payment->forceFill([
            ...$card,
            'status' => FrequencyPaymentStatus::Failed,
            'failure_reason' => mb_substr($reason, 0, 300),
            'failed_at' => now(),
            'meta' => $meta,
        ])->save();

        $this->audit->record('frequency_payment.failed', $payment->request()->firstOrFail(), [
            'payment_id' => $payment->id,
            'reason' => $payment->failure_reason,
        ], $actor);

        return ChargeResult::declined($payment->failure_reason, $result->meta);
    }

    /**
     * @param  array<string, string>|null  $authentication3ds
     */
    private function charge(FrequencyPayment $payment, string $source, ?string $email = null, ?array $authentication3ds = null): CardCharge
    {
        $payment->loadMissing(['user', 'frequency']);

        return new CardCharge(
            source: $source,
            amountCents: $payment->amount_cents,
            currency: $payment->currency,
            email: $email ?? $payment->user->email,
            description: 'Frecuencia '.$payment->frequency->display(),
            metadata: [
                'frequency_payment_id' => (string) $payment->id,
                'frequency_request_id' => (string) $payment->frequency_request_id,
                'user_id' => (string) $payment->user_id,
            ],
            authentication3ds: $authentication3ds,
        );
    }
}
