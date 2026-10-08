<?php

namespace Tests\Feature\Marketplace;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Marketplace\Enums\ListingStatus;
use App\Domain\Marketplace\Notifications\StationPurchased;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\AuditLog;
use App\Models\Frequency;
use App\Models\FrequencyListing;
use App\Models\Station;
use App\Models\StationMember;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FrequencySaleTest extends TestCase
{
    use RefreshDatabase;

    private WalletLedger $ledger;

    private User $staff;

    private Frequency $frequency;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        config([
            'platform.marketplace.processor_fee_percent' => 5,
            'platform.marketplace.fee_percent' => 10,
            'platform.marketplace.tax_percent' => 18,
            'platform.marketplace.min_price_cents' => 5000,
        ]);

        $this->ledger = app(WalletLedger::class);
        $this->staff = $this->staff(PlatformRole::SuperAdmin);
        $this->frequency = Frequency::factory()->create(['label' => '99.10', 'frequency' => '99.10', 'slug' => '99-10']);
    }

    #[Test]
    public function the_staff_puts_a_free_frequency_on_sale(): void
    {
        $this->actingAs($this->staff)
            ->post($this->controlUrl('/admin/ventas/frecuencias'), ['frequency' => '99.1', 'price_cents' => 30000, 'pitch' => 'Fácil de recordar.'])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('admin.sales.index', ['tab' => 'active']));

        $listing = FrequencyListing::query()->sole();
        $this->assertTrue($listing->by_platform);
        $this->assertNull($listing->station_id);
        $this->assertSame($this->frequency->id, $listing->frequency_id);
        $this->assertSame($this->staff->id, $listing->seller_id);
        $this->assertNull($listing->payout_method);
        $this->assertSame(FrequencyStatus::Reserved, $this->frequency->fresh()->status);
        $this->assertSame(1, AuditLog::query()->where('action', 'frequency_sale.listed')->count());

        $this->actingAs($this->staff)
            ->post($this->controlUrl('/admin/ventas/frecuencias'), ['frequency' => '99.10', 'price_cents' => 30000])
            ->assertSessionHasErrors('frequency');

        $this->actingAs($this->staff)
            ->get($this->controlUrl('/admin/ventas?tab=active'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('canListFrequencies', true)
                ->where('sales.data.0.by_platform', true)
                ->where('sales.data.0.frequency', '99.10')
                ->where('sales.data.0.payout_method', null));
    }

    #[Test]
    public function only_free_frequencies_can_be_listed_and_only_by_staff_who_assign_frequencies(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($this->staff)
            ->post($this->controlUrl('/admin/ventas/frecuencias'), ['frequency' => $station->frequency->label, 'price_cents' => 30000])
            ->assertSessionHasErrors('frequency');
        $this->actingAs($this->staff)
            ->post($this->controlUrl('/admin/ventas/frecuencias'), ['frequency' => '120.00', 'price_cents' => 30000])
            ->assertSessionHasErrors('frequency');
        $this->actingAs($this->staff)
            ->post($this->controlUrl('/admin/ventas/frecuencias'), ['frequency' => '99.10', 'price_cents' => 4999])
            ->assertSessionHasErrors('price_cents');

        $this->actingAs($this->staff(PlatformRole::Moderator))
            ->post($this->controlUrl('/admin/ventas/frecuencias'), ['frequency' => '99.10', 'price_cents' => 30000])
            ->assertForbidden();

        $this->assertSame(0, FrequencyListing::query()->count());
    }

    #[Test]
    public function buying_a_frequency_opens_a_station_for_the_buyer(): void
    {
        $listing = $this->listFrequency(30000);
        $buyer = $this->buyerWith(50000);
        $this->app['auth']->forgetGuards();

        $this->get($this->publicUrl('/frecuencias-en-venta'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('listings.data', 1)
                ->where('listings.data.0.by_platform', true)
                ->where('listings.data.0.station', null)
                ->where('listings.data.0.frequency.display', '99.10'));
        $this->get($this->publicUrl("/frecuencias-en-venta/{$listing->id}"))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Public/Marketplace/Show')->where('listenUrl', null));

        $this->actingAs($buyer)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true])
            ->assertSessionHasErrors('station_name');

        $this->actingAs($buyer)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true, 'station_name' => '  Radio Aurora  '])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $station = Station::query()->sole();
        $this->assertSame('Radio Aurora', $station->name);
        $this->assertSame($this->frequency->id, $station->frequency_id);
        $this->assertSame($buyer->id, $station->owner_id);
        $this->assertSame(
            [[$buyer->id, StationRole::Owner]],
            StationMember::query()->where('station_id', $station->id)->get()->map(fn (StationMember $member) => [$member->user_id, $member->role])->all(),
        );
        $this->assertSame(FrequencyStatus::Active, $this->frequency->fresh()->status);
        $this->assertSame(20000, $this->ledger->balance($buyer));

        $listing->refresh();
        $this->assertSame(ListingStatus::Sold, $listing->status);
        $this->assertSame($station->id, $listing->station_id);
        $this->assertSame(1500, $listing->processor_fee_cents);
        $this->assertSame(28500, $listing->fee_cents);
        $this->assertSame(0, $listing->tax_cents);
        $this->assertSame(0, $listing->payout_cents);
        $this->assertNull($listing->payout_status);
        $purchase = WalletTransaction::query()->findOrFail($listing->purchase_transaction_id);
        $this->assertSame(WalletTransactionType::StationPurchase, $purchase->type);
        $this->assertSame(-30000, $purchase->amount_cents);
        $this->assertSame(1, AuditLog::query()->where('action', 'frequency_sale.completed')->count());
        Notification::assertSentTo($buyer, StationPurchased::class);

        $this->actingAs($buyer->fresh())->get($this->studioUrl($station, '/consola'))->assertOk();
        $this->actingAs($buyer->fresh())
            ->get($this->publicUrl("/frecuencias-en-venta/{$listing->id}"))
            ->assertInertia(fn (Assert $page) => $page->where('viewer.bought', true)->whereNot('studioUrl', null));

        $this->actingAs($this->staff)
            ->get($this->controlUrl('/admin/ventas?tab=platform'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('totals.platform.count', 1)
                ->where('totals.platform.amount_cents', 28500)
                ->where('totals.to_pay.count', 0)
                ->where('sales.data.0.station', $station->displayName()));
    }

    #[Test]
    public function a_frequency_is_sold_only_once_and_the_station_name_must_be_free(): void
    {
        Station::factory()->create(['name' => 'Radio Aurora']);
        $listing = $this->listFrequency(30000);
        $first = $this->buyerWith(30000);
        $second = $this->buyerWith(30000);

        $this->actingAs($first)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true, 'station_name' => 'radio aurora'])
            ->assertSessionHasErrors('station_name');

        $this->actingAs($first)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true, 'station_name' => 'Radio Boreal'])
            ->assertSessionHasNoErrors();
        $this->actingAs($second)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true, 'station_name' => 'Radio Austral'])
            ->assertSessionHasErrors('listing');

        $this->assertSame(0, $this->ledger->balance($first));
        $this->assertSame(30000, $this->ledger->balance($second));
    }

    #[Test]
    public function a_listing_ends_when_the_frequency_is_assigned_or_released_and_the_staff_can_withdraw_it(): void
    {
        $listing = $this->listFrequency(30000);

        $this->actingAs($this->staff)
            ->post($this->controlUrl("/admin/ventas/{$listing->id}/retirar"), ['note' => 'Ya no la vendemos.'])
            ->assertSessionHasNoErrors();
        $this->assertSame(ListingStatus::Cancelled, $listing->fresh()->status);
        $this->assertSame(FrequencyStatus::Reserved, $this->frequency->fresh()->status);

        $listing = $this->listFrequency(30000);
        $this->actingAs($this->staff)
            ->post($this->controlUrl("/admin/frecuencias/{$this->frequency->slug}/liberar"))
            ->assertSessionHasNoErrors();
        $this->assertSame(ListingStatus::Cancelled, $listing->fresh()->status);
        $this->assertSame(FrequencyStatus::Available, $this->frequency->fresh()->status);

        $listing = $this->listFrequency(30000);
        $this->actingAs($this->staff)
            ->post($this->controlUrl("/admin/frecuencias/{$this->frequency->slug}/asignar"), ['email' => User::factory()->create()->email, 'name' => 'Radio Asignada'])
            ->assertSessionHasNoErrors();
        $this->assertSame(ListingStatus::Cancelled, $listing->fresh()->status);

        $buyer = $this->buyerWith(30000);
        $this->actingAs($buyer)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true, 'station_name' => 'Radio Tarde'])
            ->assertSessionHasErrors('listing');
        $this->assertSame(30000, $this->ledger->balance($buyer));
    }

    private function listFrequency(int $priceCents): FrequencyListing
    {
        $this->actingAs($this->staff)
            ->post($this->controlUrl('/admin/ventas/frecuencias'), ['frequency' => $this->frequency->label, 'price_cents' => $priceCents])
            ->assertSessionHasNoErrors();

        return FrequencyListing::query()->active()->where('frequency_id', $this->frequency->id)->sole();
    }

    private function buyerWith(int $cents): User
    {
        $buyer = User::factory()->create();
        $this->ledger->deposit($this->ledger->open($buyer), $cents, new LedgerEntry('seed:'.Str::uuid()));

        return $buyer;
    }
}
