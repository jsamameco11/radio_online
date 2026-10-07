<?php

namespace Tests\Feature\Payments;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Payments\Actions\ConfirmPayment;
use App\Domain\Payments\Actions\StartTopUp;
use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\WalletLedger;
use App\Models\Payment;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CulqiTopUpTest extends TestCase
{
    use RefreshDatabase;

    private const CHARGES = 'api.culqi.com/v2/charges';

    private const REFUNDS = 'api.culqi.com/v2/refunds';

    private User $listener;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        Http::preventStrayRequests();
        config([
            'platform.payments.driver' => 'culqi',
            'services.culqi.public_key' => 'pk_test_publica',
            'services.culqi.secret_key' => 'sk_test_secreta',
            'services.culqi.currency' => 'USD',
        ]);
        $this->listener = User::factory()->create(['email' => 'oyente@correo.com']);
    }

    #[Test]
    public function the_top_up_page_gets_the_checkout_settings_but_never_the_secret_key(): void
    {
        $payment = $this->openTopUp(1000);

        $this->assertSame('culqi', $payment->provider);

        $this->get($this->publicUrl('/billetera/recarga/'.$payment->id))
            ->assertOk()
            ->assertDontSee('sk_test_secreta')
            ->assertInertia(fn (Assert $page) => $page
                ->component('Wallet/TopUp')
                ->where('sandbox', false)
                ->where('checkout.driver', 'culqi')
                ->where('checkout.public_key', 'pk_test_publica')
                ->where('checkout.amount_cents', 1000)
                ->where('checkout.currency', 'USD')
                ->where('checkout.email', 'oyente@correo.com')
                ->where('checkout.charge_url', '/billetera/recarga/'.$payment->id.'/cargo'));

        Http::assertNothingSent();
    }

    #[Test]
    public function a_charge_uses_the_amount_of_the_payment_and_credits_the_wallet_once(): void
    {
        $payment = $this->openTopUp(1000);
        Http::fake([self::CHARGES => Http::response($this->approvedCharge($payment), 201)]);

        foreach ([1, 2, 3] as $submit) {
            $this->postJson($this->chargeUrl($payment), [
                'token' => 'tkn_test_123',
                'email' => 'tarjeta@correo.com',
                'amount' => 1,
                'amount_cents' => 1,
                'currency_code' => 'PEN',
            ])
                ->assertOk()
                ->assertJsonPath('payment.status.value', 'succeeded')
                ->assertJsonPath('balance_cents', 1000);
        }

        Http::assertSentCount(1);
        Http::assertSent(fn (Request $request) => $request->url() === 'https://api.culqi.com/v2/charges'
            && $request->method() === 'POST'
            && $request->hasHeader('Authorization', 'Bearer sk_test_secreta')
            && $request['amount'] === 1000
            && $request['currency_code'] === 'USD'
            && $request['source_id'] === 'tkn_test_123'
            && $request['email'] === 'tarjeta@correo.com'
            && $request['metadata']['payment_id'] === $payment->id);

        $payment->refresh();
        $this->assertSame(PaymentStatus::Succeeded, $payment->status);
        $this->assertSame('chr_test_aprobado', $payment->provider_reference);
        $this->assertSame('1111', $payment->meta['card_last_four']);
        $this->assertSame(1000, app(WalletLedger::class)->balance($this->listener));
        $this->assertSame(1, WalletTransaction::query()->where('type', WalletTransactionType::Deposit->value)->count());
    }

    #[Test]
    public function a_declined_card_fails_the_payment_without_touching_the_ledger(): void
    {
        $payment = $this->openTopUp(1000);
        Http::fake([self::CHARGES => Http::response([
            'object' => 'error',
            'type' => 'card_error',
            'charge_id' => 'chr_test_rechazado',
            'code' => 'card_declined',
            'decline_code' => 'insufficient_funds',
            'merchant_message' => 'La tarjeta no tiene fondos suficientes.',
            'user_message' => 'Tu tarjeta no tiene fondos suficientes.',
        ], 402)]);

        $this->postJson($this->chargeUrl($payment), ['token' => 'tkn_test_sin_fondos'])
            ->assertOk()
            ->assertJsonPath('payment.status.value', 'failed')
            ->assertJsonPath('payment.failure_reason', 'Tu tarjeta no tiene fondos suficientes.');

        $this->postJson($this->chargeUrl($payment), ['token' => 'tkn_test_otra'])
            ->assertOk()
            ->assertJsonPath('payment.status.value', 'failed');

        Http::assertSentCount(1);
        $this->assertSame('insufficient_funds', $payment->fresh()->meta['culqi_decline_code']);
        $this->assertSame(0, WalletTransaction::query()->count());
        $this->assertSame(0, app(WalletLedger::class)->balance($this->listener));
    }

    #[Test]
    public function a_card_that_needs_3d_secure_is_charged_again_with_the_issuer_answer(): void
    {
        $payment = $this->openTopUp(2000);
        Http::fake([self::CHARGES => Http::sequence()
            ->push(['action_code' => 'REVIEW', 'user_message' => 'Confirma la compra con tu banco.'], 200)
            ->push($this->approvedCharge($payment), 201)]);

        $this->postJson($this->chargeUrl($payment), ['token' => 'tkn_test_3ds'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'authentication_required')
            ->assertJsonPath('message', 'Confirma la compra con tu banco.');

        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);
        $this->assertSame(0, WalletTransaction::query()->count());
        $this->get($this->publicUrl('/billetera/recarga/'.$payment->id))
            ->assertInertia(fn (Assert $page) => $page->where('checkout.driver', 'culqi'));

        $this->postJson($this->chargeUrl($payment), [
            'token' => 'tkn_test_3ds',
            'authentication_3DS' => [
                'eci' => '05',
                'xid' => 'xid-123',
                'cavv' => 'cavv-123',
                'protocolVersion' => '2.1.0',
                'directoryServerTransactionId' => 'ds-123',
            ],
        ])
            ->assertOk()
            ->assertJsonPath('payment.status.value', 'succeeded');

        Http::assertSentCount(2);
        Http::assertSent(fn (Request $request) => ($request['authentication_3DS']['eci'] ?? null) === '05'
            && $request['authentication_3DS']['protocolVersion'] === '2.1.0'
            && $request['source_id'] === 'tkn_test_3ds');
        $this->assertSame(2000, app(WalletLedger::class)->balance($this->listener));
    }

    #[Test]
    public function a_lost_answer_keeps_the_payment_pending_and_takes_no_other_card(): void
    {
        $payment = $this->openTopUp(1000);
        Http::fake([self::CHARGES => Http::response(['object' => 'error', 'type' => 'api_error'], 500)]);

        $this->postJson($this->chargeUrl($payment), ['token' => 'tkn_test_timeout'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'charge_pending');

        $this->postJson($this->chargeUrl($payment), ['token' => 'tkn_test_otra_tarjeta'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'charge_pending');

        Http::assertSentCount(1);
        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);
        $this->assertSame(0, WalletTransaction::query()->count());

        $this->get($this->publicUrl('/billetera/recarga/'.$payment->id))
            ->assertInertia(fn (Assert $page) => $page->where('payment.status.value', 'pending')->where('checkout', null));

        $this->actingAs($this->listener)->post($this->publicUrl('/billetera/recargar'), ['amount_cents' => 1000]);
        $this->assertSame(2, Payment::query()->count());
    }

    #[Test]
    public function a_rejected_secret_key_fails_the_payment_without_charging(): void
    {
        $payment = $this->openTopUp(1000);
        Http::fake([self::CHARGES => Http::response(['object' => 'error', 'type' => 'authentication_error'], 401)]);

        $this->postJson($this->chargeUrl($payment), ['token' => 'tkn_test_123'])
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'payment_unavailable');

        $this->assertSame(PaymentStatus::Failed, $payment->fresh()->status);
        $this->assertSame(0, WalletTransaction::query()->count());
    }

    #[Test]
    public function top_ups_are_refused_while_culqi_is_not_configured(): void
    {
        config(['services.culqi.secret_key' => '']);

        $this->actingAs($this->listener)
            ->post($this->publicUrl('/billetera/recargar'), ['amount_cents' => 1000])
            ->assertSessionHas('error');

        $this->assertSame(0, Payment::query()->count());
    }

    #[Test]
    public function only_the_owner_can_charge_a_top_up(): void
    {
        $payment = $this->openTopUp(1000);
        Http::fake([self::CHARGES => Http::response($this->approvedCharge($payment), 201)]);

        $this->actingAs(User::factory()->create())
            ->postJson($this->chargeUrl($payment), ['token' => 'tkn_test_ajeno'])
            ->assertForbidden();

        $this->actingAs($this->listener)
            ->postJson($this->chargeUrl($payment), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('token');

        Http::assertNothingSent();
        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);
    }

    #[Test]
    public function a_refund_goes_through_culqi_and_takes_the_money_back_out_of_the_wallet(): void
    {
        $payment = $this->paidTopUp(1000);
        Http::fake([self::REFUNDS => Http::response(['object' => 'refund', 'id' => 'ref_test_1', 'amount' => 1000], 201)]);

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl('/admin/pagos/'.$payment->id.'/reembolso'), ['reason' => 'El oyente pidió la devolución'])
            ->assertSessionHas('success');

        Http::assertSent(fn (Request $request) => $request->url() === 'https://api.culqi.com/v2/refunds'
            && $request['amount'] === 1000
            && $request['charge_id'] === 'chr_test_aprobado'
            && $request['reason'] === 'solicitud_comprador');

        $payment->refresh();
        $this->assertSame(PaymentStatus::Refunded, $payment->status);
        $this->assertSame('ref_test_1', $payment->meta['refund_reference']);
        $this->assertSame(0, app(WalletLedger::class)->balance($this->listener));
        $this->assertDatabaseHas('wallet_transactions', ['type' => WalletTransactionType::Refund->value, 'amount_cents' => -1000]);
    }

    #[Test]
    public function a_refund_culqi_rejects_changes_nothing(): void
    {
        $payment = $this->paidTopUp(1000);
        Http::fake([self::REFUNDS => Http::response(['object' => 'error', 'merchant_message' => 'El cargo ya fue devuelto.'], 400)]);

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl('/admin/pagos/'.$payment->id.'/reembolso'), ['reason' => 'El oyente pidió la devolución'])
            ->assertSessionHas('error', 'La pasarela de pago rechazó la operación: El cargo ya fue devuelto.');

        $this->assertSame(PaymentStatus::Succeeded, $payment->fresh()->status);
        $this->assertSame(1000, app(WalletLedger::class)->balance($this->listener));
        $this->assertSame(0, WalletTransaction::query()->where('type', WalletTransactionType::Refund->value)->count());
    }

    private function openTopUp(int $cents): Payment
    {
        $this->actingAs($this->listener)
            ->post($this->publicUrl('/billetera/recargar'), ['amount_cents' => $cents])
            ->assertRedirect();

        return Payment::query()->where('amount_cents', $cents)->sole();
    }

    private function paidTopUp(int $cents): Payment
    {
        return app(ConfirmPayment::class)->handle(app(StartTopUp::class)->handle($this->listener, $cents), reference: 'chr_test_aprobado');
    }

    private function chargeUrl(Payment $payment): string
    {
        return $this->publicUrl('/billetera/recarga/'.$payment->id.'/cargo');
    }

    /**
     * @return array<string, mixed>
     */
    private function approvedCharge(Payment $payment): array
    {
        return [
            'object' => 'charge',
            'id' => 'chr_test_aprobado',
            'amount' => $payment->amount_cents,
            'currency_code' => 'USD',
            'email' => 'tarjeta@correo.com',
            'reference_code' => 'REF123',
            'outcome' => ['type' => 'venta_exitosa', 'code' => 'AUT0000', 'user_message' => 'Su compra ha sido exitosa.'],
            'source' => ['last_four' => '1111', 'iin' => ['card_brand' => 'Visa']],
            'metadata' => ['payment_id' => $payment->id],
        ];
    }
}
