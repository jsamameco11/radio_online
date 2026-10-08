<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyPaymentStatus;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Models\FrequencyRequest;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The processor never answered a charge: after checking it in the processor's
 * panel, the staff records whether it went through. Charged opens the
 * station; not charged lets the card be charged again.
 */
final class SettleFrequencyPayment
{
    public function __construct(
        private readonly ApproveFrequencyRequest $approve,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(FrequencyRequest $request, User $actor, bool $charged, ?string $reference): ?Station
    {
        $request = DB::transaction(function () use ($request, $charged, $reference) {
            $request = FrequencyRequest::query()->lockForUpdate()->with('payment')->findOrFail($request->id);
            $payment = $request->payment;

            if ($payment === null || $payment->status !== FrequencyPaymentStatus::Unconfirmed || ! $request->status->isOpen()) {
                throw ValidationException::withMessages(['request' => 'Este pago no tiene un cobro sin confirmar.']);
            }

            $payment->forceFill($charged
                ? [
                    'status' => FrequencyPaymentStatus::Paid,
                    'charge_reference' => $reference,
                    'charged_at' => now(),
                    'failure_reason' => null,
                ]
                : [
                    'status' => $request->status === FrequencyRequestStatus::AwaitingPayment ? FrequencyPaymentStatus::Failed : FrequencyPaymentStatus::CardSaved,
                    'failure_reason' => $request->status === FrequencyRequestStatus::AwaitingPayment ? 'El cobro anterior no se completó. Inténtalo de nuevo.' : null,
                ])->save();

            return $request;
        });

        $this->audit->record($charged ? 'frequency_payment.settled_paid' : 'frequency_payment.settled_unpaid', $request, array_filter([
            'payment_id' => $request->payment->id,
            'reference' => $reference,
        ]), $actor);

        if (! $charged) {
            return null;
        }

        $request->loadMissing('reviewer');

        return $this->approve->handle($request, $request->reviewer ?? $actor, null, $request->review_note);
    }
}
