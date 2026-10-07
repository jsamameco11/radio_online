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
    public function a_sandbox_top_up_is_paid_from_its_page_and_credited_once(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post($this->publicUrl('/billetera/recargar'), ['amount_cents' => 1000])
            ->assertRedirect();

        $payment = Payment::query()->sole();
        $this->assertSame(PaymentStatus::Pending, $payment->status);
        $this->assertSame('sandbox', $payment->provider);

        $this->get($this->publicUrl('/billetera/recarga/'.$payment->id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Wallet/TopUp')
                ->where('payment.status.value', 'pending')
                ->where('sandbox', true)
                ->where('checkout.driver', 'sandbox')
                ->where('checkout.amount_cents', 1000)
                ->where('checkout.charge_url', '/billetera/recarga/'.$payment->id.'/cargo'));

        foreach ([1, 2] as $attempt) {
            $this->postJson($this->publicUrl('/billetera/recarga/'.$payment->id.'/cargo'), ['token' => 'sandbox'])
                ->assertOk()
                ->assertJsonPath('payment.status.value', 'succeeded')
                ->assertJsonPath('balance_cents', 1000);
        }

        app(ConfirmPayment::class)->handle($payment);

        $this->assertSame(1000, app(WalletLedger::class)->balance($user));
        $this->assertSame(1, WalletTransaction::query()->count());
        $this->assertSame('sandbox_'.$payment->id, $payment->fresh()->provider_reference);

        $this->get($this->publicUrl('/billetera/recarga/'.$payment->id))
            ->assertInertia(fn (Assert $page) => $page->where('payment.status.value', 'succeeded')->where('checkout', null));
    }

    #[Test]
    public function choosing_the_same_amount_again_reuses_the_open_top_up(): void
    {
        $user = User::factory()->create();

        foreach ([1, 2] as $click) {
            $this->actingAs($user)->post($this->publicUrl('/billetera/recargar'), ['amount_cents' => 2000])->assertRedirect();
        }
        $this->actingAs($user)->post($this->publicUrl('/billetera/recargar'), ['amount_cents' => 5000])->assertRedirect();

        $this->assertSame(2, Payment::query()->count());
        $this->assertSame(1, Payment::query()->where('amount_cents', 2000)->count());
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

        $intruder = User::factory()->create();

        $this->actingAs($intruder)
            ->get($this->publicUrl('/billetera/recarga/'.$payment->id))
            ->assertForbidden();
        $this->actingAs($intruder)
            ->postJson($this->publicUrl('/billetera/recarga/'.$payment->id.'/cargo'), ['token' => 'sandbox'])
            ->assertForbidden();

        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);
        $this->assertSame(0, WalletTransaction::query()->count());
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
