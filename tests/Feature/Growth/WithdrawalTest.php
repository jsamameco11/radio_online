<?php

namespace Tests\Feature\Growth;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Monetization\Enums\PayoutMethod;
use App\Domain\Monetization\Enums\WithdrawalStatus;
use App\Domain\Monetization\Notifications\WithdrawalPaid;
use App\Domain\Monetization\Notifications\WithdrawalRejected;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\WalletLedger;
use App\Models\AuditLog;
use App\Models\Station;
use App\Models\WalletTransaction;
use App\Models\WithdrawalRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class WithdrawalTest extends TestCase
{
    use GrowthFixtures, RefreshDatabase;

    private Station $station;

    private int $minimum;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeMedia();
        Notification::fake();
        $this->station = Station::factory()->create();
        $this->minimum = (int) config('platform.monetization.min_withdrawal_cents');
    }

    #[Test]
    public function a_station_withdraws_from_day_one_without_being_monetized(): void
    {
        $this->creditStation($this->station, $this->minimum + 1500);
        $owner = $this->station->owner()->sole();

        $this->actingAs($owner)
            ->get($this->studioUrl($this->station, '/monetizacion'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('wallet.balance_cents', $this->minimum + 1500)
                ->where('minWithdrawalCents', $this->minimum)
                ->where('withdrawalInProcess', false)
                ->where('canAct', true)
                ->has('methods', count(PayoutMethod::cases())));

        $this->actingAs($owner)
            ->post($this->studioUrl($this->station, '/monetizacion/retiros'), $this->form($this->minimum))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertNull($this->station->fresh()->monetized_at);
        $withdrawal = WithdrawalRequest::query()->sole();
        $this->assertSame(WithdrawalStatus::Pending, $withdrawal->status);
        $this->assertSame($this->minimum, $withdrawal->amount_cents);
        $this->assertSame(1500, app(WalletLedger::class)->balance($this->station));

        $debit = WalletTransaction::query()->findOrFail($withdrawal->debit_transaction_id);
        $this->assertSame(WalletTransactionType::Withdrawal, $debit->type);
        $this->assertSame(-$this->minimum, $debit->amount_cents);
        $this->assertSame($this->minimum + 1500, $debit->balance_before_cents);
        $this->assertSame(1500, $debit->balance_after_cents);
        $this->assertSame('withdrawal:'.$withdrawal->id, $debit->idempotency_key);
        $this->assertSame(1, AuditLog::query()->where('action', 'withdrawal.request')->count());

        $this->actingAs($owner)
            ->get($this->studioUrl($this->station, '/monetizacion'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('withdrawalInProcess', true)
                ->where('withdrawals.data.0.destination', 'Yape · ···· 5678')
                ->missing('withdrawals.data.0.payout_details'));
    }

    #[Test]
    public function the_amount_must_be_at_least_the_minimum_and_at_most_the_balance(): void
    {
        $this->creditStation($this->station, $this->minimum * 2);
        $owner = $this->station->owner()->sole();

        $this->actingAs($owner)
            ->post($this->studioUrl($this->station, '/monetizacion/retiros'), $this->form($this->minimum - 1))
            ->assertSessionHasErrors('amount_cents');

        $this->actingAs($owner)
            ->post($this->studioUrl($this->station, '/monetizacion/retiros'), $this->form($this->minimum * 2 + 1))
            ->assertSessionHasErrors('amount_cents');

        $this->assertSame(0, WithdrawalRequest::query()->count());
        $this->assertSame($this->minimum * 2, app(WalletLedger::class)->balance($this->station));
    }

    #[Test]
    public function payout_details_are_validated_per_method(): void
    {
        $this->creditStation($this->station, $this->minimum);
        $owner = $this->station->owner()->sole();

        $this->actingAs($owner)
            ->post($this->studioUrl($this->station, '/monetizacion/retiros'), [...$this->form($this->minimum), 'account' => '12345'])
            ->assertSessionHasErrors('account');

        $this->actingAs($owner)
            ->post($this->studioUrl($this->station, '/monetizacion/retiros'), [...$this->form($this->minimum), 'payout_method' => 'bank_transfer', 'account' => '191-12345678-0-12'])
            ->assertSessionHasErrors('bank');

        $this->actingAs($owner)
            ->post($this->studioUrl($this->station, '/monetizacion/retiros'), [...$this->form($this->minimum), 'payout_method' => 'paypal', 'account' => 'no-es-correo'])
            ->assertSessionHasErrors('account');

        $this->assertSame(0, WithdrawalRequest::query()->count());
    }

    #[Test]
    public function one_withdrawal_at_a_time(): void
    {
        $this->creditStation($this->station, $this->minimum * 3);
        $owner = $this->station->owner()->sole();

        $this->actingAs($owner)->post($this->studioUrl($this->station, '/monetizacion/retiros'), $this->form($this->minimum))->assertSessionHasNoErrors();
        $this->actingAs($owner)->post($this->studioUrl($this->station, '/monetizacion/retiros'), $this->form($this->minimum))->assertSessionHasErrors('amount_cents');

        $this->assertSame(1, WithdrawalRequest::query()->count());
    }

    #[Test]
    public function only_the_owner_may_withdraw(): void
    {
        $this->creditStation($this->station, $this->minimum);

        foreach ([StationRole::Manager, StationRole::Host, StationRole::Editor] as $role) {
            $this->actingAs($this->teamMember($this->station, $role))
                ->post($this->studioUrl($this->station, '/monetizacion/retiros'), $this->form($this->minimum))
                ->assertForbidden();
        }

        $this->actingAs($this->staff())
            ->post($this->studioUrl($this->station, '/monetizacion/retiros'), $this->form($this->minimum))
            ->assertForbidden();

        $other = Station::factory()->create();
        $this->actingAs($other->owner()->sole())
            ->post($this->studioUrl($this->station, '/monetizacion/retiros'), $this->form($this->minimum))
            ->assertForbidden();

        $this->assertSame(0, WithdrawalRequest::query()->count());
    }

    #[Test]
    public function payout_details_are_encrypted_at_rest(): void
    {
        $withdrawal = $this->requested();

        $raw = (string) DB::table('withdrawal_requests')->where('id', $withdrawal->id)->value('payout_details');

        $this->assertStringNotContainsString('987645678', $raw);
        $this->assertStringNotContainsString('Ana Quispe', $raw);
        $this->assertSame(['holder' => 'Ana Quispe', 'account' => '987645678'], $withdrawal->fresh()->payout_details);
    }

    #[Test]
    public function the_payouts_page_requires_payouts_manage_and_shows_the_details(): void
    {
        $withdrawal = $this->requested();

        $this->actingAs($this->staff(PlatformRole::Admin))->get($this->controlUrl('/admin/retiros'))->assertForbidden();
        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl('/admin/retiros/'.$withdrawal->id.'/pagado'), ['reference' => 'OP-123'])
            ->assertForbidden();

        $this->actingAs($this->staff())
            ->get($this->controlUrl('/admin/retiros'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Withdrawals/Index')
                ->where('totals.pending.count', 1)
                ->where('totals.pending.amount_cents', $this->minimum)
                ->where('withdrawals.data.0.payout_details.account', '987645678')
                ->where('withdrawals.data.0.payout_details.holder', 'Ana Quispe'));
    }

    #[Test]
    public function a_super_admin_marks_a_withdrawal_as_paid(): void
    {
        $withdrawal = $this->requested();
        $staff = $this->staff();

        $this->actingAs($staff)
            ->post($this->controlUrl('/admin/retiros/'.$withdrawal->id.'/pagado'), ['reference' => ''])
            ->assertSessionHasErrors('reference');

        $this->actingAs($staff)
            ->post($this->controlUrl('/admin/retiros/'.$withdrawal->id.'/pagado'), ['reference' => 'OP-2026-0001'])
            ->assertSessionHasNoErrors();

        $withdrawal->refresh();
        $this->assertSame(WithdrawalStatus::Paid, $withdrawal->status);
        $this->assertSame('OP-2026-0001', $withdrawal->paid_reference);
        $this->assertSame(0, app(WalletLedger::class)->balance($this->station));
        $this->assertSame(1, AuditLog::query()->where('action', 'withdrawal.paid')->count());
        Notification::assertSentTo($this->station->owner()->sole(), WithdrawalPaid::class);

        $this->actingAs($staff)
            ->post($this->controlUrl('/admin/retiros/'.$withdrawal->id.'/rechazar'), ['note' => 'Cuenta equivocada'])
            ->assertSessionHasErrors('withdrawal');
        $this->assertSame(0, WalletTransaction::query()->where('type', WalletTransactionType::WithdrawalReversal->value)->count());
    }

    #[Test]
    public function rejecting_a_withdrawal_gives_the_money_back_once(): void
    {
        $withdrawal = $this->requested();
        $staff = $this->staff();

        $this->actingAs($staff)
            ->post($this->controlUrl('/admin/retiros/'.$withdrawal->id.'/rechazar'), ['note' => 'El celular no tiene Yape activo.'])
            ->assertSessionHasNoErrors();
        $this->actingAs($staff)
            ->post($this->controlUrl('/admin/retiros/'.$withdrawal->id.'/rechazar'), ['note' => 'El celular no tiene Yape activo.'])
            ->assertSessionHasErrors('withdrawal');

        $withdrawal->refresh();
        $this->assertSame(WithdrawalStatus::Rejected, $withdrawal->status);
        $this->assertSame($this->minimum, app(WalletLedger::class)->balance($this->station));

        $reversal = WalletTransaction::query()->findOrFail($withdrawal->reversal_transaction_id);
        $this->assertSame(WalletTransactionType::WithdrawalReversal, $reversal->type);
        $this->assertSame($this->minimum, $reversal->amount_cents);
        $this->assertSame(0, $reversal->balance_before_cents);
        $this->assertSame($this->minimum, $reversal->balance_after_cents);
        $this->assertSame('withdrawal-reversal:'.$withdrawal->id, $reversal->idempotency_key);
        $this->assertSame(1, AuditLog::query()->where('action', 'withdrawal.reject')->count());
        Notification::assertSentTo($this->station->owner()->sole(), WithdrawalRejected::class);
    }

    #[Test]
    public function another_station_never_sees_these_withdrawals(): void
    {
        $this->requested();
        $other = Station::factory()->create();

        $this->actingAs($other->owner()->sole())
            ->get($this->studioUrl($other, '/monetizacion'))
            ->assertInertia(fn (Assert $page) => $page->has('withdrawals.data', 0)->where('withdrawalInProcess', false)->where('wallet.balance_cents', 0));
    }

    private function requested(): WithdrawalRequest
    {
        $this->creditStation($this->station, $this->minimum);
        $this->actingAs($this->station->owner()->sole())
            ->post($this->studioUrl($this->station, '/monetizacion/retiros'), $this->form($this->minimum))
            ->assertSessionHasNoErrors();

        return WithdrawalRequest::query()->sole();
    }

    /**
     * @return array<string, mixed>
     */
    private function form(int $cents): array
    {
        return ['amount_cents' => $cents, 'payout_method' => 'yape', 'holder' => 'Ana Quispe', 'account' => '987645678'];
    }
}
