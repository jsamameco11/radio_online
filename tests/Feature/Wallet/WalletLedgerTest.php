<?php

namespace Tests\Feature\Wallet;

use App\Domain\Wallet\Enums\WalletStatus;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Exceptions\IdempotencyConflict;
use App\Domain\Wallet\Exceptions\InsufficientBalance;
use App\Domain\Wallet\Exceptions\InvalidAmount;
use App\Domain\Wallet\Exceptions\WalletFrozen;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\AuditLog;
use App\Models\Station;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class WalletLedgerTest extends TestCase
{
    use RefreshDatabase;

    private WalletLedger $ledger;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ledger = app(WalletLedger::class);
    }

    #[Test]
    public function a_wallet_is_opened_once_per_owner(): void
    {
        $user = User::factory()->create();

        $first = $this->ledger->open($user);
        $second = $this->ledger->open($user);

        $this->assertTrue($first->is($second));
        $this->assertSame(0, $first->balance_cents);
        $this->assertSame('user', $first->owner_type);
    }

    #[Test]
    public function a_deposit_records_the_balance_before_and_after(): void
    {
        $wallet = $this->ledger->open(User::factory()->create());

        $this->ledger->deposit($wallet, 1000, new LedgerEntry('deposit-1'));
        $transaction = $this->ledger->deposit($wallet, 500, new LedgerEntry('deposit-2', 'Recarga'));

        $this->assertSame(1000, $transaction->balance_before_cents);
        $this->assertSame(1500, $transaction->balance_after_cents);
        $this->assertSame(500, $transaction->amount_cents);
        $this->assertSame(WalletTransactionType::Deposit, $transaction->type);
        $this->assertSame(1500, $wallet->balance_cents);
        $this->assertSame(1500, $wallet->fresh()->balance_cents);
    }

    #[Test]
    public function the_same_idempotency_key_moves_money_only_once(): void
    {
        $wallet = $this->ledger->open(User::factory()->create());

        $first = $this->ledger->deposit($wallet, 1000, new LedgerEntry('payment:abc'));
        $again = $this->ledger->deposit($wallet, 1000, new LedgerEntry('payment:abc'));

        $this->assertTrue($first->is($again));
        $this->assertTrue($first->wasRecentlyCreated);
        $this->assertFalse($again->wasRecentlyCreated);
        $this->assertSame(1, WalletTransaction::query()->count());
        $this->assertSame(1000, $wallet->fresh()->balance_cents);
    }

    #[Test]
    public function reusing_a_key_for_a_different_movement_is_refused(): void
    {
        $wallet = $this->ledger->open(User::factory()->create());
        $this->ledger->deposit($wallet, 1000, new LedgerEntry('payment:abc'));

        $this->expectException(IdempotencyConflict::class);

        $this->ledger->deposit($wallet, 2000, new LedgerEntry('payment:abc'));
    }

    #[Test]
    public function a_debit_never_leaves_a_negative_balance(): void
    {
        $wallet = $this->ledger->open(User::factory()->create());
        $this->ledger->deposit($wallet, 300, new LedgerEntry('deposit'));

        try {
            $this->ledger->debit($wallet, WalletTransactionType::GiftPurchase, 301, new LedgerEntry('too-much'));
            $this->fail('The debit should have been refused.');
        } catch (InsufficientBalance $exception) {
            $this->assertSame(300, $exception->balanceCents);
            $this->assertSame(301, $exception->requiredCents);
        }

        $this->assertSame(300, $wallet->fresh()->balance_cents);
        $this->assertDatabaseMissing('wallet_transactions', ['idempotency_key' => 'too-much']);
    }

    #[Test]
    public function the_balance_is_read_from_the_locked_row_not_from_a_stale_model(): void
    {
        $wallet = $this->ledger->open(User::factory()->create());
        $stale = Wallet::query()->find($wallet->id);

        $this->ledger->deposit($wallet, 2000, new LedgerEntry('deposit'));
        $debit = $this->ledger->debit($stale, WalletTransactionType::GiftPurchase, 1500, new LedgerEntry('debit'));

        $this->assertSame(2000, $debit->balance_before_cents);
        $this->assertSame(500, $debit->balance_after_cents);
        $this->assertSame(500, $stale->balance_cents);
    }

    #[Test]
    public function a_transfer_debits_the_sender_and_credits_the_station_minus_the_fee(): void
    {
        $from = $this->ledger->open(User::factory()->create());
        $to = $this->ledger->open(Station::factory()->create());
        $this->ledger->deposit($from, 1000, new LedgerEntry('deposit'));

        [$debit, $credit] = $this->ledger->transfer($from, $to, 700, 210, new LedgerEntry('gift:1:debit'), new LedgerEntry('gift:1:credit'));

        $this->assertSame(-700, $debit->amount_cents);
        $this->assertSame(490, $credit->amount_cents);
        $this->assertSame(210, $debit->meta['platform_fee_cents']);
        $this->assertSame(300, $from->fresh()->balance_cents);
        $this->assertSame(490, $to->fresh()->balance_cents);

        [$debitAgain] = $this->ledger->transfer($from, $to, 700, 210, new LedgerEntry('gift:1:debit'), new LedgerEntry('gift:1:credit'));

        $this->assertTrue($debit->is($debitAgain));
        $this->assertSame(300, $from->fresh()->balance_cents);
        $this->assertSame(3, WalletTransaction::query()->count());
    }

    #[Test]
    public function a_transfer_without_funds_writes_nothing(): void
    {
        $from = $this->ledger->open(User::factory()->create());
        $to = $this->ledger->open(Station::factory()->create());
        $this->ledger->deposit($from, 100, new LedgerEntry('deposit'));

        try {
            $this->ledger->transfer($from, $to, 500, 150, new LedgerEntry('gift:debit'), new LedgerEntry('gift:credit'));
            $this->fail('The transfer should have been refused.');
        } catch (InsufficientBalance) {
            $this->assertSame(1, WalletTransaction::query()->count());
            $this->assertSame(0, $to->fresh()->balance_cents);
        }
    }

    #[Test]
    public function a_frozen_wallet_cannot_move_money(): void
    {
        $wallet = $this->ledger->open(User::factory()->create());
        $wallet->forceFill(['status' => WalletStatus::Frozen])->save();

        $this->expectException(WalletFrozen::class);

        $this->ledger->deposit($wallet, 500, new LedgerEntry('deposit'));
    }

    #[Test]
    public function amounts_must_be_positive(): void
    {
        $wallet = $this->ledger->open(User::factory()->create());

        $this->expectException(InvalidAmount::class);

        $this->ledger->deposit($wallet, 0, new LedgerEntry('zero'));
    }

    #[Test]
    public function an_adjustment_is_audited_and_cannot_overdraw(): void
    {
        $staff = User::factory()->create();
        $wallet = $this->ledger->open(User::factory()->create());

        $credit = $this->ledger->adjust($wallet, 750, 'Compensación por falla del servicio', $staff, 'adjust:1');

        $this->assertSame(WalletTransactionType::AdminAdjustment, $credit->type);
        $this->assertSame($staff->id, $credit->actor_id);
        $this->assertSame(750, $wallet->fresh()->balance_cents);
        $this->assertSame(1, AuditLog::query()->where('action', 'wallet.adjusted')->count());

        $this->ledger->adjust($wallet, 750, 'Compensación por falla del servicio', $staff, 'adjust:1');
        $this->assertSame(1, AuditLog::query()->where('action', 'wallet.adjusted')->count());

        $this->expectException(InsufficientBalance::class);
        $this->ledger->adjust($wallet, -800, 'Corrección', $staff, 'adjust:2');
    }

    #[Test]
    public function the_balance_always_equals_the_sum_of_its_movements(): void
    {
        $from = $this->ledger->open(User::factory()->create());
        $to = $this->ledger->open(Station::factory()->create());

        $this->ledger->deposit($from, 2000, new LedgerEntry('d1'));
        $this->ledger->transfer($from, $to, 300, 90, new LedgerEntry('g1:debit'), new LedgerEntry('g1:credit'));
        $this->ledger->transfer($from, $to, 999, 300, new LedgerEntry('g2:debit'), new LedgerEntry('g2:credit'));
        $this->ledger->refund($from, 500, new LedgerEntry('r1'));

        foreach ([$from, $to] as $wallet) {
            $this->assertSame(
                (int) WalletTransaction::query()->where('wallet_id', $wallet->id)->sum('amount_cents'),
                $wallet->fresh()->balance_cents,
            );
        }

        $this->assertSame(201, $from->fresh()->balance_cents);
        $this->assertSame(210 + 699, $to->fresh()->balance_cents);
    }
}
