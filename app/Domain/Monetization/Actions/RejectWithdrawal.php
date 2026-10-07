<?php

namespace App\Domain\Monetization\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Monetization\Enums\WithdrawalStatus;
use App\Domain\Monetization\Notifications\WithdrawalRejected;
use App\Domain\Stations\Support\StationLinks;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\User;
use App\Models\WithdrawalRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** The platform cannot pay a withdrawal: the amount is credited back to the station wallet. */
final class RejectWithdrawal
{
    public function __construct(
        private readonly WalletLedger $ledger,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(WithdrawalRequest $withdrawal, User $reviewer, string $note): WithdrawalRequest
    {
        $withdrawal = DB::transaction(function () use ($withdrawal, $reviewer, $note) {
            $withdrawal = WithdrawalRequest::acrossStations()->lockForUpdate()->with(['station.frequency', 'station.owner'])->findOrFail($withdrawal->id);

            if ($withdrawal->status !== WithdrawalStatus::Pending) {
                throw ValidationException::withMessages(['withdrawal' => 'Este retiro ya fue procesado.']);
            }

            $reversal = $this->ledger->credit(
                $this->ledger->open($withdrawal->station),
                WalletTransactionType::WithdrawalReversal,
                $withdrawal->amount_cents,
                new LedgerEntry("withdrawal-reversal:{$withdrawal->id}", 'Retiro devuelto: '.$note, $withdrawal, $reviewer, ['note' => $note]),
            );

            $withdrawal->forceFill([
                'status' => WithdrawalStatus::Rejected,
                'reversal_transaction_id' => $reversal->id,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'review_note' => $note,
            ])->save();

            return $withdrawal;
        });

        $station = $withdrawal->station;
        $this->audit->record('withdrawal.reject', $withdrawal, [
            'amount_cents' => $withdrawal->amount_cents,
            'note' => $note,
            'wallet_transaction_id' => $withdrawal->reversal_transaction_id,
        ], $reviewer, $station);

        $station->owner?->notify(new WithdrawalRejected(
            $withdrawal->id,
            $station->displayName(),
            $withdrawal->formattedAmount(),
            $note,
            StationLinks::studio($station).'/monetizacion',
        ));

        return $withdrawal;
    }
}
