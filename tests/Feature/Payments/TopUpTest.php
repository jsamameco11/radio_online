<?php

namespace Tests\Feature\Payments;

use App\Domain\Payments\Actions\ConfirmPayment;
use App\Domain\Payments\Actions\StartTopUp;
use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Wallet\Exceptions\InvalidAmount;
use App\Domain\Wallet\WalletLedger;
use App\Models\Payment;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TopUpTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    #[Test]
    public function the_wallet_page_shows_the_balance_and_the_presets(): void
    {
        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl('/billetera'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Wallet/Show')
                ->where('wallet.balance_cents', 0)
                ->where('topUp.min_cents', 500)
                ->where('topUp.presets', [500, 1000, 2000, 5000, 10_000])
                ->where('topUp.sandbox', true));
    }

    #[Test]
    public function the_minimum_deposit_is_enforced_by_the_backend(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post($this->publicUrl('/billetera/recargar'), ['amount_cents' => 499])
            ->assertSessionHasErrors('amount_cents');

        $this->assertSame(0, Payment::query()->count());

        $this->expectException(InvalidAmount::class);
        app(StartTopUp::class)->handle($user, 499);
    }

    #[Test]
    public function a_sandbox_top_up_is_credited_once_when_the_listener_returns(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post($this->publicUrl('/billetera/recargar'), ['amount_cents' => 1000])
            ->assertRedirect();

        $payment = Payment::query()->sole();
        $this->assertSame(PaymentStatus::Pending, $payment->status);
        $this->assertSame('sandbox', $payment->provider);

        foreach ([1, 2] as $visit) {
            $this->get($this->publicUrl('/billetera/recarga/'.$payment->id))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Wallet/TopUp')
                    ->where('payment.status.value', 'succeeded')
                    ->where('balance_cents', 1000)
                    ->where('sandbox', true));
        }

        app(ConfirmPayment::class)->handle($payment);

        $this->assertSame(1000, app(WalletLedger::class)->balance($user));
        $this->assertSame(1, WalletTransaction::query()->count());
        $this->assertNotNull($payment->fresh()->wallet_transaction_id);
    }

    #[Test]
    public function the_balance_endpoint_answers_json(): void
    {
        $user = User::factory()->create();
        app(ConfirmPayment::class)->handle(app(StartTopUp::class)->handle($user, 2000));

        $this->actingAs($user)
            ->getJson($this->publicUrl('/billetera/saldo'))
            ->assertOk()
            ->assertExactJson(['balance_cents' => 2000, 'currency' => 'USD']);
    }

    #[Test]
    public function listeners_cannot_see_other_listeners_payments(): void
    {
        $payment = app(StartTopUp::class)->handle(User::factory()->create(), 1000);

        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl('/billetera/recarga/'.$payment->id))
            ->assertForbidden();

        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);
    }

    #[Test]
    public function the_wallet_requires_a_verified_account(): void
    {
        $this->getJson($this->publicUrl('/billetera/saldo'))->assertUnauthorized();

        $this->actingAs(User::factory()->unverified()->create())
            ->get($this->publicUrl('/billetera'))
            ->assertRedirect();
    }
}
