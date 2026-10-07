<?php

namespace App\Domain\Monetization\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Monetization\Enums\WithdrawalStatus;
use App\Domain\Monetization\Notifications\WithdrawalPaid;
use App\Domain\Stations\Support\StationLinks;
use App\Models\User;
use App\Models\WithdrawalRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** The platform sent the money of a withdrawal and records the transfer reference. */
final class MarkWithdrawalPaid
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(WithdrawalRequest $withdrawal, User $reviewer, string $reference, ?string $note): WithdrawalRequest
    {
        $withdrawal = DB::transaction(function () use ($withdrawal, $reviewer, $reference, $note) {
            $withdrawal = WithdrawalRequest::acrossStations()->lockForUpdate()->with(['station.frequency', 'station.owner'])->findOrFail($withdrawal->id);

            if ($withdrawal->status !== WithdrawalStatus::Pending) {
                throw ValidationException::withMessages(['withdrawal' => 'Este retiro ya fue procesado.']);
            }

            $withdrawal->forceFill([
                'status' => WithdrawalStatus::Paid,
                'paid_reference' => $reference,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'review_note' => $note,
            ])->save();

            return $withdrawal;
        });

        $station = $withdrawal->station;
        $this->audit->record('withdrawal.paid', $withdrawal, [
            'amount_cents' => $withdrawal->amount_cents,
            'reference' => $reference,
        ], $reviewer, $station);

        $station->owner?->notify(new WithdrawalPaid(
            $withdrawal->id,
            $station->displayName(),
            $withdrawal->formattedAmount(),
            $withdrawal->maskedDestination(),
            $reference,
            StationLinks::studio($station).'/monetizacion',
        ));

        return $withdrawal;
    }
}
