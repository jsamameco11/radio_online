<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyPaymentStatus;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Payments\Exceptions\AuthenticationRequired;
use App\Domain\Payments\Exceptions\CardDeclined;
use App\Domain\Payments\PaymentGateways;
use App\Domain\Payments\Support\CardHolder;
use App\Models\FrequencyPayment;
use App\Models\FrequencyRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The applicant of a priced frequency registers the card that will be charged
 * if the staff approves. Nothing is charged now; a new card replaces the old.
 */
final class SaveFrequencyCard
{
    public function __construct(
        private readonly PaymentGateways $gateways,
        private readonly AuditTrail $audit,
    ) {}

    /**
     * @param  array<string, string>|null  $authentication3ds
     *
     * @throws AuthenticationRequired
     * @throws CardDeclined
     */
    public function handle(FrequencyRequest $request, string $token, ?array $authentication3ds = null): FrequencyPayment
    {
        $request->loadMissing(['user', 'application', 'payment']);
        $payment = $request->payment ?? throw ValidationException::withMessages(['card' => 'Esta solicitud no tiene pagos.']);

        $this->ensureEditable($request, $payment);

        $saved = $this->gateways->cards($payment->provider)->saveCard($this->holder($request), $token, $authentication3ds);

        [$payment, $replaced] = DB::transaction(function () use ($request, $payment, $saved) {
            $request = FrequencyRequest::query()->lockForUpdate()->findOrFail($request->id);
            $payment = FrequencyPayment::query()->lockForUpdate()->findOrFail($payment->id);
            $this->ensureEditable($request, $payment);

            $replaced = $payment->card_id;
            $payment->forceFill([
                'status' => FrequencyPaymentStatus::CardSaved,
                'customer_id' => $saved->customerId,
                'card_id' => $saved->cardId,
                'card_brand' => $saved->brand,
                'card_last_four' => $saved->lastFour,
                'card_saved_at' => now(),
            ])->save();

            return [$payment, $replaced];
        });

        if ($replaced !== null && $replaced !== $saved->cardId) {
            $this->gateways->cards($payment->provider)->forgetCard($replaced);
        }

        $this->audit->record('frequency_payment.card_saved', $request, [
            'payment_id' => $payment->id,
            'card' => $payment->cardLabel(),
        ], $request->user);

        return $payment;
    }

    private function ensureEditable(FrequencyRequest $request, FrequencyPayment $payment): void
    {
        if ($request->status !== FrequencyRequestStatus::Pending
            || ! in_array($payment->status, [FrequencyPaymentStatus::CardRequired, FrequencyPaymentStatus::CardSaved], true)) {
            throw ValidationException::withMessages(['card' => 'Ya no puedes cambiar la tarjeta de esta solicitud.']);
        }
    }

    private function holder(FrequencyRequest $request): CardHolder
    {
        $application = $request->application
            ?? throw ValidationException::withMessages(['card' => 'Completa primero el formulario de tu solicitud.']);

        return new CardHolder(
            firstName: $application->first_names,
            lastName: $application->last_names,
            email: $request->user->email,
            phone: $application->phone,
            countryCode: $application->country,
            city: $application->city,
            address: $application->address,
        );
    }
}
