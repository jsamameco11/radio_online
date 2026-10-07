<?php

namespace App\Domain\Monetization\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Monetization\Enums\PayoutMethod;
use App\Domain\Monetization\Enums\WithdrawalStatus;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\Station;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A station takes earnings out of its wallet. Open to every station from day
 * one, from config('platform.monetization.min_withdrawal_cents') up to its
 * balance, one withdrawal in process at a time. The amount is debited right
 * away, inside the same transaction that records the request.
 */
final class RequestWithdrawal
{
    public function __construct(
        private readonly WalletLedger $ledger,
        private readonly AuditTrail $audit,
    ) {}

    /**
     * @param  array{holder: string, account: string, bank?: ?string}  $details
     */
    public function handle(Station $station, User $user, int $amountCents, PayoutMethod $method, array $details): WithdrawalRequest
    {
        $minimum = (int) config('platform.monetization.min_withdrawal_cents');
        if ($amountCents < $minimum) {
            throw ValidationException::withMessages(['amount_cents' => 'El retiro mínimo es de US$ '.number_format($minimum / 100, 2).'.']);
        }

        $wallet = $this->ledger->open($station);

        $withdrawal = DB::transaction(function () use ($station, $user, $amountCents, $method, $details, $wallet) {
            $locked = Wallet::query()->lockForUpdate()->findOrFail($wallet->id);

            $inProcess = WithdrawalRequest::acrossStations()
                ->where('station_id', $station->id)
                ->where('status', WithdrawalStatus::Pending->value)
                ->exists();
            if ($inProcess) {
                throw ValidationException::withMessages(['amount_cents' => 'Ya tienes un retiro en proceso. Podrás pedir otro cuando lo paguemos.']);
            }

            if ($amountCents > $locked->balance_cents) {
                throw ValidationException::withMessages(['amount_cents' => 'El monto supera el saldo disponible de tu radio.']);
            }

            $withdrawal = WithdrawalRequest::query()->create([
                'station_id' => $station->id,
                'requested_by' => $user->id,
                'amount_cents' => $amountCents,
                'currency' => $locked->currency,
                'status' => WithdrawalStatus::Pending,
                'payout_method' => $method,
                'payout_details' => array_filter([
                    'holder' => $details['holder'],
                    'account' => $details['account'],
                    'bank' => $method->needsBank() ? ($details['bank'] ?? null) : null,
                ], fn (?string $value) => filled($value)),
            ]);

            $debit = $this->ledger->debit($wallet, WalletTransactionType::Withdrawal, $amountCents, new LedgerEntry(
                "withdrawal:{$withdrawal->id}",
                'Retiro a '.$withdrawal->maskedDestination(),
                $withdrawal,
                $user,
            ));

            $withdrawal->forceFill(['debit_transaction_id' => $debit->id])->save();

            return $withdrawal;
        });

        $this->audit->record('withdrawal.request', $withdrawal, [
            'amount_cents' => $amountCents,
            'payout_method' => $method->value,
            'wallet_transaction_id' => $withdrawal->debit_transaction_id,
        ], $user, $station);

        return $withdrawal;
    }
}
