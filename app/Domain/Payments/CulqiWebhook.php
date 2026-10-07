<?php

namespace App\Domain\Payments;

use App\Domain\Payments\Actions\ConfirmPayment;
use App\Domain\Payments\Enums\ChargeStatus;
use App\Domain\Payments\Exceptions\ChargePending;
use App\Domain\Payments\Gateways\CulqiGateway;
use App\Models\Payment;

/**
 * Culqi's "charge.creation.succeeded" notification. It settles top-ups whose
 * charge went through while the browser never got the answer (timeouts,
 * closed tabs). Nothing in the payload is trusted: only the charge id is
 * read, and the charge itself is fetched from Culqi with the secret key, so
 * a forged notification can at most confirm a charge that really happened.
 */
final class CulqiWebhook
{
    private const EVENT = 'charge.creation.succeeded';

    public function __construct(
        private readonly CulqiGateway $culqi,
        private readonly ConfirmPayment $confirm,
    ) {}

    /**
     * @param  array<string, mixed>  $event
     *
     * @throws ChargePending when Culqi cannot be reached, so the notification is retried
     */
    public function handle(array $event): ?Payment
    {
        $chargeId = $this->chargeId($event);

        if ($chargeId === null) {
            return null;
        }

        $this->culqi->ensureAvailable();
        $charge = $this->culqi->retrieveCharge($chargeId);
        $paymentId = $charge === null ? null : data_get($charge, 'metadata.payment_id');

        if ($charge === null || ! is_string($paymentId)) {
            return null;
        }

        $payment = Payment::query()->where('provider', $this->culqi->name())->find($paymentId);

        if ($payment === null) {
            return null;
        }

        $result = $this->culqi->interpret($payment, $charge);

        return $result->status === ChargeStatus::Succeeded
            ? $this->confirm->handle($payment, $result->meta, $result->reference)
            : null;
    }

    /**
     * @param  array<string, mixed>  $event
     */
    private function chargeId(array $event): ?string
    {
        if (($event['type'] ?? null) !== self::EVENT) {
            return null;
        }

        $data = $event['data'] ?? null;

        if (is_string($data)) {
            $data = json_decode($data, true);
        }

        $id = is_array($data) ? ($data['id'] ?? null) : null;

        return is_string($id) ? $id : null;
    }
}
