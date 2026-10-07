<?php

namespace Tests\Feature\Payments;

use App\Domain\Payments\Actions\StartTopUp;
use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Wallet\WalletLedger;
use App\Models\Payment;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CulqiWebhookTest extends TestCase
{
    use RefreshDatabase;

    private User $listener;

    private Payment $payment;

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
        config([
            'platform.payments.driver' => 'culqi',
            'services.culqi.public_key' => 'pk_test_publica',
            'services.culqi.secret_key' => 'sk_test_secreta',
            'services.culqi.currency' => 'USD',
        ]);
        $this->listener = User::factory()->create();
        $this->payment = app(StartTopUp::class)->handle($this->listener, 1000);
    }

    #[Test]
    public function it_settles_a_charge_whose_answer_never_reached_the_browser(): void
    {
        Http::fake([
            'api.culqi.com/v2/charges' => Http::response(['object' => 'error', 'type' => 'api_error'], 500),
            'api.culqi.com/v2/charges/chr_test_perdido' => Http::response($this->charge(), 200),
        ]);

        $this->actingAs($this->listener)
            ->postJson($this->publicUrl('/billetera/recarga/'.$this->payment->id.'/cargo'), ['token' => 'tkn_test_123'])
            ->assertJsonPath('reason', 'charge_pending');

        foreach ([1, 2] as $delivery) {
            $this->postJson('/webhooks/culqi', $this->event(['id' => 'chr_test_perdido', 'amount' => 1]))->assertOk();
        }

        Http::assertSent(fn (Request $request) => $request->method() === 'GET'
            && $request->url() === 'https://api.culqi.com/v2/charges/chr_test_perdido'
            && $request->hasHeader('Authorization', 'Bearer sk_test_secreta'));

        $payment = $this->payment->fresh();
        $this->assertSame(PaymentStatus::Succeeded, $payment->status);
        $this->assertSame('chr_test_perdido', $payment->provider_reference);
        $this->assertSame(1000, app(WalletLedger::class)->balance($this->listener));
        $this->assertSame(1, WalletTransaction::query()->count());
    }

    #[Test]
    public function forged_or_mismatched_notifications_credit_nothing(): void
    {
        Http::fake([
            'api.culqi.com/v2/charges/chr_test_desconocido' => Http::response(['object' => 'error', 'type' => 'invalid_request_error'], 404),
            'api.culqi.com/v2/charges/chr_test_otro_monto' => Http::response($this->charge(['id' => 'chr_test_otro_monto', 'amount' => 500]), 200),
            'api.culqi.com/v2/charges/chr_test_rechazado' => Http::response($this->charge(['id' => 'chr_test_rechazado', 'outcome' => ['type' => 'venta_rechazada']]), 200),
        ]);

        $this->postJson('/webhooks/culqi', $this->event(['id' => 'chr_test_desconocido']))->assertOk();
        $this->postJson('/webhooks/culqi', $this->event(['id' => 'chr_test_otro_monto']))->assertOk();
        $this->postJson('/webhooks/culqi', $this->event(['id' => 'chr_test_rechazado']))->assertOk();
        $this->postJson('/webhooks/culqi', $this->event(['id' => '../tokens/tkn_test']))->assertOk();
        $this->postJson('/webhooks/culqi', ['type' => 'order.status.changed', 'data' => ['id' => 'chr_test_otro_monto']])->assertOk();

        Http::assertSentCount(3);
        $this->assertSame(PaymentStatus::Pending, $this->payment->fresh()->status);
        $this->assertSame(0, WalletTransaction::query()->count());
    }

    #[Test]
    public function culqi_retries_while_its_api_cannot_be_reached(): void
    {
        Http::fake(['api.culqi.com/v2/charges/chr_test_perdido' => Http::response('', 503)]);

        $this->postJson('/webhooks/culqi', $this->event(['id' => 'chr_test_perdido']))->assertServiceUnavailable();

        $this->assertSame(PaymentStatus::Pending, $this->payment->fresh()->status);
    }

    /**
     * Culqi sends the charge as a JSON string inside "data".
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function event(array $data): array
    {
        return [
            'object' => 'event',
            'id' => 'evt_test_1',
            'type' => 'charge.creation.succeeded',
            'data' => json_encode(['object' => 'charge', ...$data]),
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function charge(array $overrides = []): array
    {
        return [
            'object' => 'charge',
            'id' => 'chr_test_perdido',
            'amount' => 1000,
            'currency_code' => 'USD',
            'outcome' => ['type' => 'venta_exitosa', 'code' => 'AUT0000'],
            'metadata' => ['payment_id' => $this->payment->id],
            ...$overrides,
        ];
    }
}
