<?php

namespace Tests\Feature\Payments;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Payments\Actions\ConfirmPayment;
use App\Domain\Payments\Actions\StartTopUp;
use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\AuditLog;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AdminPaymentsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    #[Test]
    public function only_staff_with_payments_view_see_the_payments(): void
    {
        $this->paidTopUp(User::factory()->create(), 1000);

        $this->actingAs($this->staff(PlatformRole::Moderator))
            ->get($this->controlUrl('/admin/pagos'))
            ->assertForbidden();

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->get($this->controlUrl('/admin/pagos'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Payments/Index')
                ->has('payments.data', 1)
                ->where('totals.succeeded.amount_cents', 1000)
                ->where('canRefund', true));
    }

    #[Test]
    public function a_refund_takes_the_money_back_out_of_the_wallet(): void
    {
        $listener = User::factory()->create();
        $payment = $this->paidTopUp($listener, 1000);

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl('/admin/pagos/'.$payment->id.'/reembolso'), ['reason' => 'Cargo duplicado'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertSame(PaymentStatus::Refunded, $payment->fresh()->status);
        $this->assertSame(0, app(WalletLedger::class)->balance($listener));
        $this->assertDatabaseHas('wallet_transactions', ['type' => WalletTransactionType::Refund->value, 'amount_cents' => -1000]);
        $this->assertSame(1, AuditLog::query()->where('action', 'payment.refunded')->count());
    }

    #[Test]
    public function money_already_spent_cannot_be_refunded(): void
    {
        $listener = User::factory()->create();
        $payment = $this->paidTopUp($listener, 1000);
        $ledger = app(WalletLedger::class);
        $ledger->debit($ledger->open($listener), WalletTransactionType::GiftPurchase, 600, new LedgerEntry('spent'));

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl('/admin/pagos/'.$payment->id.'/reembolso'), ['reason' => 'Cargo duplicado'])
            ->assertSessionHas('error');

        $this->assertSame(PaymentStatus::Succeeded, $payment->fresh()->status);
        $this->assertSame(400, $ledger->balance($listener));
    }

    #[Test]
    public function refunds_need_the_refund_permission(): void
    {
        $payment = $this->paidTopUp(User::factory()->create(), 1000);
        $viewer = $this->staff(PlatformRole::Moderator);
        $viewer->givePermissionTo('payments.view');

        $this->actingAs($viewer)
            ->post($this->controlUrl('/admin/pagos/'.$payment->id.'/reembolso'), ['reason' => 'Cargo duplicado'])
            ->assertForbidden();

        $this->assertSame(PaymentStatus::Succeeded, $payment->fresh()->status);
    }

    private function paidTopUp(User $user, int $cents): Payment
    {
        return app(ConfirmPayment::class)->handle(app(StartTopUp::class)->handle($user, $cents));
    }
}
