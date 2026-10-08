<?php

namespace App\Domain\Frequencies\Support;

use App\Domain\Frequencies\Enums\FrequencyPaymentStatus;
use App\Domain\Payments\PaymentGateways;
use App\Models\FrequencyRequest;
use Illuminate\Validation\ValidationException;

/**
 * A rejected or withdrawn request of a priced frequency: its payment is
 * cancelled and the card on file is removed from the processor. Money that
 * was (or may have been) charged blocks it, so it is never lost track of.
 */
final class ReleaseFrequencyPayment
{
    public function __construct(private readonly PaymentGateways $gateways) {}

    /** @throws ValidationException */
    public function ensureReleasable(FrequencyRequest $request): void
    {
        $status = $request->payment?->status;

        if ($status === FrequencyPaymentStatus::Paid) {
            throw ValidationException::withMessages(['request' => 'Esta frecuencia ya se cobró. Apruébala (puedes elegir otra frecuencia libre) en lugar de cerrarla.']);
        }

        if ($status === FrequencyPaymentStatus::Unconfirmed) {
            throw ValidationException::withMessages(['request' => 'Hay un cobro sin confirmar. Hay que resolverlo antes de cerrar la solicitud.']);
        }
    }

    public function handle(FrequencyRequest $request): void
    {
        $payment = $request->payment;

        if ($payment === null || $payment->status === FrequencyPaymentStatus::Cancelled) {
            return;
        }

        $cardId = $payment->card_id;
        $payment->forceFill(['status' => FrequencyPaymentStatus::Cancelled, 'card_id' => null])->save();

        if ($cardId !== null) {
            $this->gateways->cards($payment->provider)->forgetCard($cardId);
        }
    }
}
