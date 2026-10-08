<?php

namespace Tests\Feature\Frequencies;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Frequencies\Enums\FrequencyPaymentStatus;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Frequencies\Notifications\FrequencyPaymentFailed;
use App\Domain\Frequencies\Notifications\FrequencyRequestApproved;
use App\Models\AuditLog;
use App\Models\Frequency;
use App\Models\FrequencyPayment;
use App\Models\FrequencyRequest;
use App\Models\Station;
use App\Models\StationApplication;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Applications\ApplicationFixtures;
use Tests\TestCase;

class PricedFrequencyTest extends TestCase
{
    use ApplicationFixtures, RefreshDatabase;

    private Frequency $frequency;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeMedia();
        $this->seed(CategorySeeder::class);
        config(['platform.payments.driver' => 'sandbox']);
        $this->frequency = Frequency::factory()->create();
    }

    private function priced(int $cents = 25000): Frequency
    {
        $this->frequency->forceFill(['status' => FrequencyStatus::Reserved, 'reserved_at' => now(), 'price_cents' => $cents])->save();

        return $this->frequency;
    }

    /** A pending request of the priced frequency with its dossier and payment, as the application form leaves it. */
    private function pricedRequest(FrequencyPaymentStatus $status = FrequencyPaymentStatus::CardRequired, ?string $cardId = null): FrequencyRequest
    {
        $frequency = $this->priced();
        $application = StationApplication::factory()->create();
        $request = $application->frequencyRequest;
        $request->forceFill(['frequency_id' => $frequency->id])->save();
        $request->payment()->create([
            'user_id' => $request->user_id,
            'frequency_id' => $frequency->id,
            'amount_cents' => 25000,
            'currency' => 'USD',
            'provider' => 'sandbox',
            'status' => $status,
            'card_id' => $cardId,
            'card_brand' => $cardId ? 'Visa' : null,
            'card_last_four' => $cardId ? '4242' : null,
        ]);

        return $request->refresh();
    }

    private function adminFrequencyUrl(string $path = ''): string
    {
        return $this->controlUrl('/admin/frecuencias/'.$this->frequency->slug.$path);
    }

    #[Test]
    public function the_staff_reserves_a_frequency_with_a_price_and_it_is_offered_in_the_application(): void
    {
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)
            ->post($this->adminFrequencyUrl('/reservar'), ['note' => 'Frecuencia redonda', 'price_cents' => 1000])
            ->assertSessionHasErrors('price_cents');
        $this->assertSame(FrequencyStatus::Available, $this->frequency->fresh()->status);

        $this->actingAs($admin)
            ->post($this->adminFrequencyUrl('/reservar'), ['note' => 'Frecuencia redonda', 'price_cents' => 25000])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $frequency = $this->frequency->fresh();
        $this->assertSame(FrequencyStatus::Reserved, $frequency->status);
        $this->assertSame(25000, $frequency->price_cents);
        $this->assertTrue(AuditLog::query()->where('action', 'frequency.reserved')->where('meta->price_cents', 25000)->exists());

        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl('/obten-tu-frecuencia'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/CreateStation')
                ->where('frequencies', fn ($frequencies) => collect($frequencies)->contains(fn ($item) => $item['id'] === $frequency->id && $item['price_cents'] === 25000)));
    }

    #[Test]
    public function the_price_of_a_reserved_frequency_changes_or_goes_away(): void
    {
        $this->priced();
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)->post($this->adminFrequencyUrl('/precio'), ['price_cents' => 40000])->assertSessionHasNoErrors();
        $this->assertSame(40000, $this->frequency->fresh()->price_cents);

        $this->actingAs($admin)->post($this->adminFrequencyUrl('/precio'), ['price_cents' => null])->assertSessionHasNoErrors();
        $this->assertNull($this->frequency->fresh()->price_cents);
        $this->assertFalse($this->frequency->fresh()->isRequestable());

        $this->actingAs($admin)->post($this->adminFrequencyUrl('/liberar'));
        $this->actingAs($admin)->post($this->adminFrequencyUrl('/precio'), ['price_cents' => 40000])->assertSessionHasErrors('price_cents');
    }

    #[Test]
    public function applying_for_a_priced_frequency_leads_to_registering_a_card(): void
    {
        $this->priced();
        $applicant = User::factory()->create();

        $response = $this->actingAs($applicant)
            ->post($this->publicUrl('/obten-tu-frecuencia'), $this->applicationPayload($this->frequency))
            ->assertSessionHasNoErrors();

        $request = FrequencyRequest::query()->with('payment')->sole();
        $response->assertRedirect($this->publicUrl('/obten-tu-frecuencia/solicitudes/'.$request->id.'/pago'));
        $this->assertSame(FrequencyPaymentStatus::CardRequired, $request->payment->status);
        $this->assertSame(25000, $request->payment->amount_cents);
        $this->assertSame(FrequencyStatus::Reserved, $this->frequency->fresh()->status);

        $this->actingAs($applicant)
            ->get($this->publicUrl('/obten-tu-frecuencia/solicitudes/'.$request->id.'/pago'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/FrequencyPayment')
                ->where('mode', 'card')
                ->where('request.payment.amount', 'US$ 250.00')
                ->where('checkout.driver', 'sandbox')
                ->where('checkout.amount_cents', 25000)
                ->where('checkout.action_url', '/obten-tu-frecuencia/solicitudes/'.$request->id.'/tarjeta'));

        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl('/obten-tu-frecuencia/solicitudes/'.$request->id.'/pago'))
            ->assertNotFound();
    }

    #[Test]
    public function the_card_is_kept_and_charged_only_when_the_staff_approves(): void
    {
        Notification::fake();
        $request = $this->pricedRequest();
        $applicant = $request->user;

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl('/admin/solicitudes/'.$request->id.'/aprobar'), ['note' => 'Bienvenida'])
            ->assertSessionHasErrors('request');

        $this->actingAs($applicant)
            ->postJson($this->publicUrl('/obten-tu-frecuencia/solicitudes/'.$request->id.'/tarjeta'), ['token' => 'sandbox_approved'])
            ->assertOk()
            ->assertJsonPath('payment.status.value', 'card_saved')
            ->assertJsonPath('payment.card', 'Visa •••• 4242')
            ->assertJsonMissingPath('payment.card_id');

        $payment = $request->payment->fresh();
        $this->assertSame(FrequencyPaymentStatus::CardSaved, $payment->status);
        $this->assertNull($payment->charged_at);

        $admin = $this->staff(PlatformRole::Admin);
        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/solicitudes/'.$request->id.'/aprobar'), ['note' => 'Bienvenida', 'frequency' => '99.90'])
            ->assertSessionHasErrors('frequency');

        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/solicitudes/'.$request->id.'/aprobar'), ['note' => 'Bienvenida'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $request->refresh();
        $this->assertSame(FrequencyRequestStatus::Approved, $request->status);
        $this->assertSame(FrequencyPaymentStatus::Paid, $request->payment->fresh()->status);
        $this->assertNotNull($request->payment->fresh()->charge_reference);
        $station = Station::query()->sole();
        $this->assertSame($this->frequency->id, $station->frequency_id);
        $this->assertSame(FrequencyStatus::Active, $this->frequency->fresh()->status);
        $this->assertNull($this->frequency->fresh()->price_cents);
        $this->assertTrue(AuditLog::query()->where('action', 'frequency_payment.paid')->exists());
        Notification::assertSentTo($applicant, FrequencyRequestApproved::class);
    }

    #[Test]
    public function a_declined_charge_shows_on_both_sides_and_the_applicant_pays_with_another_card(): void
    {
        Notification::fake();
        $request = $this->pricedRequest(FrequencyPaymentStatus::CardSaved, 'sandbox_crd_declined_abc');
        $applicant = $request->user;
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/solicitudes/'.$request->id.'/aprobar'), ['note' => 'Bienvenida'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('error', fn (string $message) => str_contains($message, 'Fondos insuficientes'));

        $request->refresh();
        $payment = $request->payment->fresh();
        $this->assertSame(FrequencyRequestStatus::AwaitingPayment, $request->status);
        $this->assertSame($admin->id, $request->reviewed_by);
        $this->assertSame(FrequencyPaymentStatus::Failed, $payment->status);
        $this->assertStringContainsString('Fondos insuficientes', $payment->failure_reason);
        $this->assertSame(0, Station::query()->count());
        Notification::assertSentTo($applicant, FrequencyPaymentFailed::class, fn (FrequencyPaymentFailed $notification) => str_ends_with($notification->payUrl, '/obten-tu-frecuencia/solicitudes/'.$request->id.'/pago'));

        $this->actingAs($admin)
            ->get($this->controlUrl('/admin/solicitudes?tab=payment'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('counts.payment', 1)
                ->where('requests.data.0.status', 'awaiting_payment')
                ->where('requests.data.0.payment.status.value', 'failed')
                ->where('requests.data.0.payment.failure_reason', $payment->failure_reason));

        $this->actingAs($applicant)
            ->get($this->publicUrl('/cuenta/perfil'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('frequencyPayments.0.id', $request->id)
                ->where('frequencyPayments.0.payment.status.value', 'failed')
                ->where('frequencyPayments.0.payment_url', '/obten-tu-frecuencia/solicitudes/'.$request->id.'/pago'));

        $this->actingAs($applicant)
            ->postJson($this->publicUrl('/obten-tu-frecuencia/solicitudes/'.$request->id.'/pago'), ['token' => 'sandbox_declined'])
            ->assertStatus(422)
            ->assertJsonPath('reason', 'card_declined');
        $this->assertSame(2, $payment->fresh()->attempts);

        $this->actingAs($applicant)
            ->postJson($this->publicUrl('/obten-tu-frecuencia/solicitudes/'.$request->id.'/pago'), ['token' => 'sandbox_approved'])
            ->assertOk();

        $request->refresh();
        $this->assertSame(FrequencyRequestStatus::Approved, $request->status);
        $this->assertSame($admin->id, $request->reviewed_by);
        $this->assertSame(FrequencyPaymentStatus::Paid, $request->payment->fresh()->status);
        $this->assertSame($this->frequency->id, Station::query()->sole()->frequency_id);
        Notification::assertSentTo($applicant, FrequencyRequestApproved::class);

        $this->actingAs($applicant)
            ->postJson($this->publicUrl('/obten-tu-frecuencia/solicitudes/'.$request->id.'/pago'), ['token' => 'sandbox_approved'])
            ->assertForbidden();
    }

    #[Test]
    public function rejecting_or_cancelling_drops_the_card_and_charges_nothing(): void
    {
        $request = $this->pricedRequest(FrequencyPaymentStatus::CardSaved, 'sandbox_crd_abc');

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl('/admin/solicitudes/'.$request->id.'/rechazar'), ['note' => 'El proyecto no cumple los requisitos.'])
            ->assertSessionHasNoErrors();

        $payment = $request->payment->fresh();
        $this->assertSame(FrequencyRequestStatus::Rejected, $request->fresh()->status);
        $this->assertSame(FrequencyPaymentStatus::Cancelled, $payment->status);
        $this->assertNull($payment->card_id);
        $this->assertNull($payment->charged_at);
    }

    #[Test]
    public function an_unconfirmed_charge_blocks_everything_until_the_staff_settles_it(): void
    {
        $request = $this->pricedRequest(FrequencyPaymentStatus::Unconfirmed, 'sandbox_crd_abc');
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/solicitudes/'.$request->id.'/aprobar'), ['note' => 'Bienvenida'])
            ->assertSessionHasErrors('request');
        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/solicitudes/'.$request->id.'/rechazar'), ['note' => 'El proyecto no cumple los requisitos.'])
            ->assertSessionHasErrors('request');
        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/solicitudes/'.$request->id.'/pago'), ['charged' => true, 'reference' => 'chr_live_123'])
            ->assertForbidden();

        $treasurer = $this->staff(PlatformRole::SuperAdmin);
        $this->actingAs($treasurer)
            ->post($this->controlUrl('/admin/solicitudes/'.$request->id.'/pago'), ['charged' => true])
            ->assertSessionHasErrors('reference');

        $this->actingAs($treasurer)
            ->post($this->controlUrl('/admin/solicitudes/'.$request->id.'/pago'), ['charged' => true, 'reference' => 'chr_live_123'])
            ->assertSessionHasNoErrors();

        $this->assertSame(FrequencyRequestStatus::Approved, $request->fresh()->status);
        $this->assertSame('chr_live_123', $request->payment->fresh()->charge_reference);
        $this->assertSame(1, Station::query()->count());
    }

    #[Test]
    public function with_culqi_the_card_is_attached_to_a_customer_and_charged_for_the_frequency_price(): void
    {
        config([
            'platform.payments.driver' => 'culqi',
            'services.culqi.public_key' => 'pk_test_publica',
            'services.culqi.secret_key' => 'sk_test_secreta',
            'services.culqi.currency' => 'USD',
        ]);
        Http::preventStrayRequests();
        Http::fake([
            'api.culqi.com/v2/customers?*' => Http::response(['data' => []]),
            'api.culqi.com/v2/customers' => Http::response(['object' => 'customer', 'id' => 'cus_test_1'], 201),
            'api.culqi.com/v2/cards' => Http::response(['object' => 'card', 'id' => 'crd_test_1', 'source' => ['last_four' => '1111', 'iin' => ['card_brand' => 'Visa']]], 201),
            'api.culqi.com/v2/charges' => Http::response([
                'object' => 'error',
                'type' => 'card_error',
                'user_message' => 'Tu tarjeta no tiene fondos suficientes.',
                'decline_code' => 'insufficient_funds',
                'charge_id' => 'chr_test_declined',
            ], 402),
        ]);
        $request = $this->pricedRequest();
        $request->payment->forceFill(['provider' => 'culqi'])->save();

        $this->actingAs($request->user)
            ->postJson($this->publicUrl('/obten-tu-frecuencia/solicitudes/'.$request->id.'/tarjeta'), ['token' => 'tkn_test_123'])
            ->assertOk()
            ->assertJsonPath('payment.card', 'Visa •••• 1111');

        Http::assertSent(fn (Request $sent) => $sent->url() === 'https://api.culqi.com/v2/customers'
            && $sent['email'] === $request->user->email
            && $sent['country_code'] === $request->application->country
            && preg_match('/^\d+$/', $sent['phone_number']) === 1);
        Http::assertSent(fn (Request $sent) => str_ends_with($sent->url(), '/cards') && $sent['customer_id'] === 'cus_test_1' && $sent['token_id'] === 'tkn_test_123');

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl('/admin/solicitudes/'.$request->id.'/aprobar'), ['note' => 'Bienvenida'])
            ->assertSessionHas('error');

        Http::assertSent(fn (Request $sent) => str_ends_with($sent->url(), '/charges') && $sent['source_id'] === 'crd_test_1' && $sent['amount'] === 25000 && $sent['currency_code'] === 'USD');
        $payment = FrequencyPayment::query()->sole();
        $this->assertSame(FrequencyPaymentStatus::Failed, $payment->status);
        $this->assertSame('Tu tarjeta no tiene fondos suficientes.', $payment->failure_reason);
        $this->assertSame(FrequencyRequestStatus::AwaitingPayment, $request->fresh()->status);
    }
}
