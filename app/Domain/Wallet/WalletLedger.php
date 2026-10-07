<?php

namespace App\Domain\Wallet;

use App\Domain\Audit\AuditTrail;
use App\Domain\Wallet\Enums\WalletStatus;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Exceptions\IdempotencyConflict;
use App\Domain\Wallet\Exceptions\InsufficientBalance;
use App\Domain\Wallet\Exceptions\InvalidAmount;
use App\Domain\Wallet\Exceptions\WalletFrozen;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Models\Station;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * The only code allowed to change a wallet balance.
 *
 * Every movement runs inside a database transaction with the wallet rows
 * locked, writes one wallet_transactions row with the balance before and
 * after, and carries an idempotency key: posting the same key again returns
 * the movement already written instead of moving money twice.
 */
final class WalletLedger
{
    private const ATTEMPTS = 3;

    public function __construct(private readonly AuditTrail $audit) {}

    public static function currency(): string
    {
        return (string) config('platform.wallet.currency');
    }

    /** The wallet of a listener or a station, created empty on first use. */
    public function open(User|Station $owner): Wallet
    {
        return Wallet::query()->firstOrCreate([
            'owner_type' => $owner->getMorphClass(),
            'owner_id' => $owner->getKey(),
            'currency' => self::currency(),
        ]);
    }

    public function balance(User|Station $owner): int
    {
        return (int) Wallet::query()
            ->where('owner_type', $owner->getMorphClass())
            ->where('owner_id', $owner->getKey())
            ->where('currency', self::currency())
            ->value('balance_cents');
    }

    public function deposit(Wallet $wallet, int $amountCents, LedgerEntry $entry): WalletTransaction
    {
        $this->assertPositive($amountCents);

        return $this->post($wallet, WalletTransactionType::Deposit, $amountCents, $entry);
    }

    public function credit(Wallet $wallet, WalletTransactionType $type, int $amountCents, LedgerEntry $entry): WalletTransaction
    {
        $this->assertPositive($amountCents);

        return $this->post($wallet, $type, $amountCents, $entry);
    }

    public function debit(Wallet $wallet, WalletTransactionType $type, int $amountCents, LedgerEntry $entry): WalletTransaction
    {
        $this->assertPositive($amountCents);

        return $this->post($wallet, $type, -$amountCents, $entry);
    }

    /** Gives back to the payment provider money a deposit brought in. */
    public function refund(Wallet $wallet, int $amountCents, LedgerEntry $entry): WalletTransaction
    {
        return $this->debit($wallet, WalletTransactionType::Refund, $amountCents, $entry);
    }

    /**
     * Moves $amountCents out of $from and credits $to with that amount minus
     * $feeCents, which the platform keeps. Both rows are written in the same
     * database transaction, with both wallets locked in a fixed order.
     *
     * @return array{0: WalletTransaction, 1: WalletTransaction} The debit and the credit.
     */
    public function transfer(
        Wallet $from,
        Wallet $to,
        int $amountCents,
        int $feeCents,
        LedgerEntry $debit,
        LedgerEntry $credit,
        WalletTransactionType $debitType = WalletTransactionType::GiftPurchase,
        WalletTransactionType $creditType = WalletTransactionType::GiftEarning,
    ): array {
        $this->assertPositive($amountCents);

        if ($feeCents < 0 || $feeCents >= $amountCents) {
            throw InvalidAmount::feeOutOfRange();
        }

        if ($from->is($to)) {
            throw new InvalidArgumentException('A wallet cannot transfer to itself.');
        }

        $creditCents = $amountCents - $feeCents;

        return DB::transaction(function () use ($from, $to, $amountCents, $feeCents, $creditCents, $debit, $credit, $debitType, $creditType) {
            $locked = $this->lock(collect([$from, $to]));

            $existingDebit = $this->existing($debit->idempotencyKey, $locked[$from->id], $debitType, -$amountCents);
            if ($existingDebit !== null) {
                $existingCredit = $this->existing($credit->idempotencyKey, $locked[$to->id], $creditType, $creditCents)
                    ?? throw new IdempotencyConflict($credit->idempotencyKey);

                return [$existingDebit, $existingCredit];
            }

            $debitEntry = new LedgerEntry(
                $debit->idempotencyKey,
                $debit->description,
                $debit->source,
                $debit->actor,
                [...$debit->meta, 'platform_fee_cents' => $feeCents, 'credited_cents' => $creditCents],
            );

            $rows = [
                $this->write($locked[$from->id], $debitType, -$amountCents, $debitEntry),
                $this->write($locked[$to->id], $creditType, $creditCents, $credit),
            ];

            $this->sync($from, $locked[$from->id]);
            $this->sync($to, $locked[$to->id]);

            return $rows;
        }, self::ATTEMPTS);
    }

    /**
     * A manual correction by the platform staff: positive credits the wallet,
     * negative debits it (never below zero). Always audited.
     */
    public function adjust(Wallet $wallet, int $amountCents, string $reason, User $actor, string $idempotencyKey): WalletTransaction
    {
        if ($amountCents === 0) {
            throw InvalidAmount::zero();
        }

        $transaction = $this->post($wallet, WalletTransactionType::AdminAdjustment, $amountCents, new LedgerEntry(
            $idempotencyKey,
            'Ajuste administrativo: '.$reason,
            actor: $actor,
            meta: ['reason' => $reason],
        ));

        if ($transaction->wasRecentlyCreated) {
            $this->audit->record('wallet.adjusted', $wallet, [
                'amount_cents' => $amountCents,
                'reason' => $reason,
                'wallet_transaction_id' => $transaction->id,
                'owner' => $wallet->owner_type.':'.$wallet->owner_id,
            ], $actor, $wallet->owner_type === 'station' ? Station::query()->find($wallet->owner_id) : null);
        }

        return $transaction;
    }

    private function post(Wallet $wallet, WalletTransactionType $type, int $signedCents, LedgerEntry $entry): WalletTransaction
    {
        return DB::transaction(function () use ($wallet, $type, $signedCents, $entry) {
            $locked = $this->lock(collect([$wallet]))[$wallet->id];

            $transaction = $this->existing($entry->idempotencyKey, $locked, $type, $signedCents)
                ?? $this->write($locked, $type, $signedCents, $entry);

            $this->sync($wallet, $locked);

            return $transaction;
        }, self::ATTEMPTS);
    }

    /**
     * Re-reads the wallets with a row lock, lowest id first so two transfers
     * between the same wallets can never wait on each other.
     *
     * @param  Collection<int, Wallet>  $wallets
     * @return Collection<int, Wallet>
     */
    private function lock(Collection $wallets): Collection
    {
        return Wallet::query()
            ->whereKey($wallets->map->getKey()->unique()->sort()->values()->all())
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');
    }

    private function existing(string $key, Wallet $wallet, WalletTransactionType $type, int $signedCents): ?WalletTransaction
    {
        $transaction = WalletTransaction::query()->where('idempotency_key', $key)->first();

        if ($transaction !== null && ($transaction->wallet_id !== $wallet->id || $transaction->type !== $type || $transaction->amount_cents !== $signedCents)) {
            throw new IdempotencyConflict($key);
        }

        return $transaction;
    }

    private function write(Wallet $wallet, WalletTransactionType $type, int $signedCents, LedgerEntry $entry): WalletTransaction
    {
        if ($wallet->status !== WalletStatus::Active) {
            throw new WalletFrozen;
        }

        $before = $wallet->balance_cents;
        $after = $before + $signedCents;

        if ($signedCents < 0 && $after < 0) {
            throw new InsufficientBalance($before, -$signedCents);
        }

        $wallet->forceFill(['balance_cents' => $after])->save();

        return WalletTransaction::query()->create([
            'wallet_id' => $wallet->id,
            'type' => $type,
            'amount_cents' => $signedCents,
            'balance_before_cents' => $before,
            'balance_after_cents' => $after,
            'currency' => $wallet->currency,
            'status' => 'posted',
            'idempotency_key' => $entry->idempotencyKey,
            'description' => $entry->description === null ? null : mb_substr($entry->description, 0, 255),
            'source_type' => $entry->source?->getMorphClass(),
            'source_id' => $entry->source?->getKey() === null ? null : (string) $entry->source->getKey(),
            'actor_id' => $entry->actor?->id,
            'meta' => $entry->meta ?: null,
            'created_at' => now(),
        ]);
    }

    /** Keeps the caller's model in step with the locked row. */
    private function sync(Wallet $target, Wallet $locked): void
    {
        $target->forceFill(['balance_cents' => $locked->balance_cents])->syncOriginalAttribute('balance_cents');
    }

    private function assertPositive(int $amountCents): void
    {
        if ($amountCents <= 0) {
            throw InvalidAmount::notPositive();
        }
    }
}
