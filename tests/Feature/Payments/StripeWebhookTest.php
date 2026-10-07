<?php

namespace Tests\Feature\Payments;

use App\Domain\Payments\Enums\PaymentStatus;
use App\Domain\Wallet\WalletLedger;
use App\Models\Payment;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StripeWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'whsec_test_secret';

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.stripe.webhook_secret' => self::SECRET]);
    }

    #[Test]
    public function a_paid_checkout_credits_the_wallet_exactly_once(): void
    {
        $payment = $this->pendingPayment(1000);
        $payload = $this->event('checkout.session.completed', $payment, ['payment_status' => 'paid', 'amount_total' => 1000]);

        $this->deliver($payload)->assertOk();
        $this->deliver($payload)->assertOk();

        $payment->refresh();
        $this->assertSame(PaymentStatus::Succeeded, $payment->status);
        $this->assertSame('pi_test_1', $payment->meta['payment_intent']);
        $this->assertSame(1000, app(WalletLedger::class)->balance($payment->user()->sole()));
        $this->assertSame(1, WalletTransaction::query()->count());
    }

    #[Test]
    public function an_invalid_signature_is_rejected(): void
    {
        $payment = $this->pendingPayment(1000);
        $payload = $this->event('checkout.session.completed', $payment, ['payment_status' => 'paid', 'amount_total' => 1000]);

        $this->deliver($payload, 'whsec_someone_else')->assertStatus(400);
        $this->deliver($payload, signature: 't=1,v1=forged')->assertStatus(400);

        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);
        $this->assertSame(0, WalletTransaction::query()->count());
    }

    #[Test]
    public function a_session_whose_amount_does_not_match_is_not_credited(): void
    {
        $payment = $this->pendingPayment(1000);

        $this->deliver($this->event('checkout.session.completed', $payment, ['payment_status' => 'paid', 'amount_total' => 100]))->assertOk();

        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);
        $this->assertSame(0, WalletTransaction::query()->count());
    }

    #[Test]
    public function an_expired_checkout_cancels_the_payment(): void
    {
        $payment = $this->pendingPayment(1000);

        $this->deliver($this->event('checkout.session.expired', $payment, ['payment_status' => 'unpaid', 'status' => 'expired', 'amount_total' => 1000]))->assertOk();

        $this->assertSame(PaymentStatus::Cancelled, $payment->fresh()->status);
    }

    #[Test]
    public function without_a_webhook_secret_nothing_is_accepted(): void
    {
        config(['services.stripe.webhook_secret' => null]);
        $payment = $this->pendingPayment(1000);

        $this->deliver($this->event('checkout.session.completed', $payment, ['payment_status' => 'paid', 'amount_total' => 1000]), '')
            ->assertStatus(503);

        $this->assertSame(PaymentStatus::Pending, $payment->fresh()->status);
    }

    private function pendingPayment(int $cents): Payment
    {
        return Payment::query()->create([
            'user_id' => User::factory()->create()->id,
            'provider' => 'stripe',
            'provider_reference' => 'cs_test_1',
            'amount_cents' => $cents,
            'currency' => 'USD',
            'status' => PaymentStatus::Pending,
        ]);
    }

    /**
     * @param  array<string, mixed>  $session
     */
    private function event(string $type, Payment $payment, array $session): string
    {
        return (string) json_encode([
            'id' => 'evt_test_1',
            'object' => 'event',
            'type' => $type,
            'data' => ['object' => [
                'id' => 'cs_test_1',
                'object' => 'checkout.session',
                'status' => 'complete',
                'currency' => 'usd',
                'client_reference_id' => $payment->id,
                'metadata' => ['payment_id' => $payment->id],
                'payment_intent' => 'pi_test_1',
                ...$session,
            ]],
        ]);
    }

    private function deliver(string $payload, string $secret = self::SECRET, ?string $signature = null): TestResponse
    {
        $timestamp = time();
        $signature ??= 't='.$timestamp.',v1='.hash_hmac('sha256', $timestamp.'.'.$payload, $secret);

        return $this->call('POST', $this->publicUrl('/webhooks/stripe'), server: [
            'HTTP_STRIPE_SIGNATURE' => $signature,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], content: $payload);
    }
}
