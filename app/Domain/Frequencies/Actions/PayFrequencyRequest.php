<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Frequencies\FrequencyCharges;
use App\Domain\Payments\Enums\ChargeStatus;
use App\Domain\Payments\Exceptions\AuthenticationRequired;
use App\Domain\Payments\Exceptions\CardDeclined;
use App\Domain\Payments\Support\ChargeAttempt;
use App\Models\FrequencyRequest;
use App\Models\Station;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * The staff approved a priced frequency but the card on file was declined:
 * the applicant pays with another card and the approval completes at once,
 * signed by the reviewer who approved it.
 */
final class PayFrequencyRequest
{
    public function __construct(
        private readonly FrequencyCharges $charges,
        private readonly ApproveFrequencyRequest $approve,
    ) {}

    /**
     * @throws AuthenticationRequired
     * @throws CardDeclined
     */
    public function handle(FrequencyRequest $request, User $payer, ChargeAttempt $attempt): Station
    {
        $request->loadMissing(['payment', 'frequency', 'reviewer']);

        if ($request->status !== FrequencyRequestStatus::AwaitingPayment || $request->payment === null) {
            throw ValidationException::withMessages(['card' => 'Esta solicitud no tiene un pago pendiente.']);
        }

        ApproveFrequencyRequest::ensureFree($request->frequency);

        $result = $this->charges->chargeToken($request->payment, $attempt, $payer);

        if ($result->status === ChargeStatus::RequiresAuthentication) {
            throw new AuthenticationRequired($result->message);
        }

        if ($result->status === ChargeStatus::Declined) {
            throw new CardDeclined($result->message);
        }

        return $this->approve->handle($request, $request->reviewer ?? $payer, null, $request->review_note)
            ?? throw ValidationException::withMessages(['card' => 'No pudimos completar la aprobación. Nuestro equipo lo revisará.']);
    }
}
