<?php

namespace Tests\Feature\Marketplace;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Marketplace\Enums\ListingStatus;
use App\Domain\Marketplace\Enums\SalePayoutStatus;
use App\Domain\Marketplace\Notifications\ListingWithdrawn;
use App\Domain\Marketplace\Notifications\SalePayoutSent;
use App\Domain\Marketplace\Notifications\StationPurchased;
use App\Domain\Marketplace\Notifications\StationSold;
use App\Domain\Marketplace\Notifications\StationTeamReleased;
use App\Domain\Monetization\Enums\WithdrawalStatus;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\AuditLog;
use App\Models\FrequencyListing;
use App\Models\FrequencyRequest;
use App\Models\Station;
use App\Models\StationMember;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\WithdrawalRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StationSaleTest extends TestCase
{
    use RefreshDatabase;

    private Station $station;

    private User $owner;

    private WalletLedger $ledger;

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
        $this->station = Station::factory()->create();
        $this->owner = $this->station->owner()->sole();
    }

    #[Test]
    public function the_owner_puts_the_station_on_sale(): void
    {
        $this->actingAs($this->owner)
            ->get($this->studioUrl($this->station, '/vender'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Settings/Sale')
                ->where('listing', null)
                ->where('blocked', null)
                ->where('processorFeePercent', 5)
                ->where('feePercent', 10)
                ->where('taxPercent', 18));

        $this->actingAs($this->owner)
            ->post($this->studioUrl($this->station, '/vender'), $this->form(150000))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $listing = FrequencyListing::query()->sole();
        $this->assertSame(ListingStatus::Active, $listing->status);
        $this->assertSame(150000, $listing->price_cents);
        $this->assertSame($this->owner->id, $listing->seller_id);
        $this->assertSame($this->station->frequency_id, $listing->frequency_id);
        $this->assertSame(['holder' => 'Ana Torres', 'account' => '912345678'], $listing->payout_details);
        $this->assertStringNotContainsString('912345678', (string) FrequencyListing::query()->toBase()->value('payout_details'));
        $this->assertSame(1, AuditLog::query()->where('action', 'station_sale.listed')->count());

        $this->actingAs($this->owner)
            ->post($this->studioUrl($this->station, '/vender'), $this->form(120000))
            ->assertSessionHasNoErrors();

        $this->assertSame(120000, FrequencyListing::query()->sole()->price_cents);
    }

    #[Test]
    public function only_the_owner_can_sell(): void
    {
        $manager = $this->teamMember($this->station, StationRole::Manager);

        $this->actingAs($manager)->get($this->studioUrl($this->station, '/vender'))->assertForbidden();
        $this->actingAs($manager)->post($this->studioUrl($this->station, '/vender'), $this->form(150000))->assertForbidden();

        $this->assertSame(0, FrequencyListing::query()->count());
    }

    #[Test]
    public function the_price_must_be_within_the_limits_and_the_seller_must_confirm(): void
    {
        $this->actingAs($this->owner)
            ->post($this->studioUrl($this->station, '/vender'), $this->form(4999))
            ->assertSessionHasErrors('price_cents');

        $this->actingAs($this->owner)
            ->post($this->studioUrl($this->station, '/vender'), [...$this->form(150000), 'confirm' => false])
            ->assertSessionHasErrors('confirm');

        $this->actingAs($this->owner)
            ->post($this->studioUrl($this->station, '/vender'), [...$this->form(150000), 'account' => '12345'])
            ->assertSessionHasErrors('account');

        $this->assertSame(0, FrequencyListing::query()->count());
    }

    #[Test]
    public function a_station_with_a_withdrawal_in_process_cannot_be_listed_and_a_listed_one_cannot_withdraw(): void
    {
        $withdrawal = WithdrawalRequest::acrossStations()->create([
            'station_id' => $this->station->id,
            'requested_by' => $this->owner->id,
            'amount_cents' => 2000,
            'currency' => 'USD',
            'status' => WithdrawalStatus::Pending,
            'payout_method' => 'yape',
            'payout_details' => ['holder' => 'Ana Torres', 'account' => '912345678'],
        ]);

        $this->actingAs($this->owner)
            ->post($this->studioUrl($this->station, '/vender'), $this->form(150000))
            ->assertSessionHasErrors('price_cents');

        $withdrawal->forceFill(['status' => WithdrawalStatus::Paid])->save();
        $this->list(150000);
        $this->credit($this->ledger->open($this->station), 50000);

        $this->actingAs($this->owner)
            ->post($this->studioUrl($this->station, '/monetizacion/retiros'), [
                'amount_cents' => (int) config('platform.monetization.min_withdrawal_cents'),
                'payout_method' => 'yape',
                'holder' => 'Ana Torres',
                'account' => '912345678',
            ])
            ->assertSessionHasErrors('amount_cents');
    }

    #[Test]
    public function buying_hands_the_whole_station_to_the_buyer(): void
    {
        $manager = $this->teamMember($this->station, StationRole::Manager);
        $listing = $this->list(150000);
        $this->credit($this->ledger->open($this->station), 3250);
        FrequencyRequest::query()->create([
            'kind' => FrequencyRequestKind::FrequencyChange,
            'user_id' => $this->owner->id,
            'station_id' => $this->station->id,
            'frequency_id' => $this->station->frequency_id,
            'station_name' => $this->station->name,
            'pitch' => 'Queremos una frecuencia más fácil de recordar.',
            'category_ids' => [],
            'status' => FrequencyRequestStatus::Pending,
        ]);
        $buyer = $this->buyerWith(200000);

        $this->actingAs($buyer)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('site.marketplace.show', $listing->id))
            ->assertSessionHas('success');

        $station = $this->station->fresh();
        $this->assertSame($buyer->id, $station->owner_id);
        $this->assertSame(
            [[$buyer->id, StationRole::Owner]],
            StationMember::query()->where('station_id', $station->id)->get()->map(fn (StationMember $member) => [$member->user_id, $member->role])->all(),
        );

        $this->assertSame(50000, $this->ledger->balance($buyer));
        $this->assertSame(0, $this->ledger->balance($station));

        $listing->refresh();
        $this->assertSame(ListingStatus::Sold, $listing->status);
        $this->assertSame($buyer->id, $listing->buyer_id);
        $this->assertSame(7500, $listing->processor_fee_cents);
        $this->assertSame(15000, $listing->fee_cents);
        $this->assertSame(2700, $listing->tax_cents);
        $this->assertSame(3250, $listing->settled_balance_cents);
        $this->assertSame(124800 + 3250, $listing->payout_cents);
        $this->assertSame(SalePayoutStatus::Pending, $listing->payout_status);

        $purchase = WalletTransaction::query()->findOrFail($listing->purchase_transaction_id);
        $this->assertSame(WalletTransactionType::StationPurchase, $purchase->type);
        $this->assertSame(-150000, $purchase->amount_cents);
        $this->assertSame("station-sale:{$listing->id}:purchase", $purchase->idempotency_key);
        $settlement = WalletTransaction::query()->where('idempotency_key', "station-sale:{$listing->id}:settlement")->sole();
        $this->assertSame(WalletTransactionType::SaleSettlement, $settlement->type);
        $this->assertSame(-3250, $settlement->amount_cents);

        $this->assertSame(FrequencyRequestStatus::Cancelled, FrequencyRequest::query()->sole()->status);
        $this->assertSame(1, AuditLog::query()->where('action', 'station_sale.completed')->count());

        Notification::assertSentTo($this->owner, StationSold::class, fn (StationSold $notification) => $notification->payout === 'US$ 1,280.50');
        Notification::assertSentTo($buyer, StationPurchased::class);
        Notification::assertSentTo($manager, StationTeamReleased::class);
        Notification::assertNotSentTo($this->owner, StationTeamReleased::class);

        $this->actingAs($this->owner->fresh())->get($this->studioUrl($station, '/consola'))->assertRedirectContains('obten-tu-frecuencia');
        $this->actingAs($manager->fresh())->get($this->studioUrl($station, '/consola'))->assertRedirectContains('obten-tu-frecuencia');
        $buyer = $buyer->fresh();
        $this->actingAs($buyer)->get($this->studioUrl($station, '/vender'))->assertOk();

        $this->actingAs($buyer)
            ->get($this->publicUrl("/frecuencias-en-venta/{$listing->id}"))
            ->assertInertia(fn (Assert $page) => $page
                ->where('listing.status', 'sold')
                ->where('viewer.bought', true)
                ->whereNot('studioUrl', null));
    }

    #[Test]
    public function the_buyer_needs_enough_balance(): void
    {
        $listing = $this->list(150000);
        $buyer = $this->buyerWith(149999);

        $this->actingAs($buyer)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true])
            ->assertSessionHas('error');

        $this->assertSame(ListingStatus::Active, $listing->fresh()->status);
        $this->assertSame($this->owner->id, $this->station->fresh()->owner_id);
        $this->assertSame(149999, $this->ledger->balance($buyer));
    }

    #[Test]
    public function a_station_is_sold_only_once_and_never_to_its_seller(): void
    {
        $listing = $this->list(150000);
        $this->ledger->deposit($this->ledger->open($this->owner), 200000, new LedgerEntry('seed:'.Str::uuid()));

        $this->actingAs($this->owner)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true])
            ->assertSessionHasErrors('listing');

        $first = $this->buyerWith(150000);
        $second = $this->buyerWith(150000);

        $this->actingAs($first)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true])
            ->assertSessionHasNoErrors();
        $this->actingAs($second)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true])
            ->assertSessionHasErrors('listing');

        $this->assertSame($first->id, $this->station->fresh()->owner_id);
        $this->assertSame(150000, $this->ledger->balance($second));
    }

    #[Test]
    public function the_buyer_must_confirm_and_suspended_or_withdrawn_stations_cannot_be_bought(): void
    {
        $listing = $this->list(150000);
        $buyer = $this->buyerWith(200000);

        $this->actingAs($buyer)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), [])
            ->assertSessionHasErrors('accepted');

        $this->station->forceFill(['status' => StationStatus::Suspended])->save();
        $this->actingAs($buyer)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true])
            ->assertSessionHasErrors('listing');

        $this->station->forceFill(['status' => StationStatus::Active])->save();
        $this->actingAs($this->owner)->delete($this->studioUrl($this->station, '/vender'))->assertSessionHas('success');
        $this->assertSame(ListingStatus::Cancelled, $listing->fresh()->status);

        $this->actingAs($buyer)
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true])
            ->assertSessionHasErrors('listing');
        $this->get($this->publicUrl("/frecuencias-en-venta/{$listing->id}"))->assertNotFound();

        $this->assertSame(200000, $this->ledger->balance($buyer));
    }

    #[Test]
    public function the_market_lists_only_active_listings_and_the_station_page_shows_the_offer(): void
    {
        $listing = $this->list(150000);
        $other = Station::factory()->create();
        FrequencyListing::query()->create([
            'station_id' => $other->id,
            'frequency_id' => $other->frequency_id,
            'seller_id' => $other->owner_id,
            'price_cents' => 90000,
            'currency' => 'USD',
            'status' => ListingStatus::Cancelled,
            'payout_method' => 'yape',
            'payout_details' => ['holder' => 'Luis', 'account' => '987654321'],
        ]);
        $this->app['auth']->forgetGuards();

        $this->get($this->publicUrl('/frecuencias-en-venta'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Marketplace/Index')
                ->has('listings.data', 1)
                ->where('listings.data.0.id', $listing->id)
                ->where('listings.data.0.price_cents', 150000)
                ->missing('listings.data.0.payout_details')
                ->missing('listings.data.0.seller_id'));

        $this->get($this->publicUrl('/frecuencias-en-venta/'.$listing->id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Marketplace/Show')
                ->where('viewer', null));

        $this->get($this->publicUrl('/radio/'.$this->station->frequency->slug))
            ->assertInertia(fn (Assert $page) => $page->where('forSale.url', '/frecuencias-en-venta/'.$listing->id));
    }

    #[Test]
    public function the_staff_pays_the_seller_and_can_take_a_listing_down(): void
    {
        $listing = $this->list(150000);
        $this->actingAs($this->buyerWith(150000))
            ->post($this->publicUrl("/frecuencias-en-venta/{$listing->id}/comprar"), ['accepted' => true]);
        $staff = $this->staff(PlatformRole::SuperAdmin);

        $this->actingAs($staff)
            ->get($this->controlUrl('/admin/ventas'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Sales/Index')
                ->where('totals.to_pay.amount_cents', 124800)
                ->where('totals.fees_cents', 15000)
                ->where('sales.data.0.payout_details.account', '912345678'));

        $this->actingAs($staff)
            ->post($this->controlUrl("/admin/ventas/{$listing->id}/pagado"), ['reference' => 'OP-123456'])
            ->assertSessionHasNoErrors();

        $listing->refresh();
        $this->assertSame(SalePayoutStatus::Paid, $listing->payout_status);
        $this->assertSame('OP-123456', $listing->payout_reference);
        Notification::assertSentTo($this->owner, SalePayoutSent::class);

        $this->actingAs($staff)
            ->post($this->controlUrl("/admin/ventas/{$listing->id}/pagado"), ['reference' => 'OP-999999'])
            ->assertSessionHasErrors('listing');

        $other = Station::factory()->create();
        $otherListing = $this->list(80000, $other);
        $this->actingAs($staff)
            ->post($this->controlUrl("/admin/ventas/{$otherListing->id}/retirar"), ['note' => 'Datos de cobro de otra persona.'])
            ->assertSessionHasNoErrors();

        $this->assertSame(ListingStatus::Cancelled, $otherListing->fresh()->status);
        Notification::assertSentTo($other->owner, ListingWithdrawn::class);
    }

    /**
     * @return array<string, mixed>
     */
    private function form(int $priceCents): array
    {
        return [
            'price_cents' => $priceCents,
            'pitch' => 'Audiencia fiel por las mañanas.',
            'payout_method' => 'yape',
            'holder' => 'Ana Torres',
            'account' => '912345678',
            'confirm' => true,
        ];
    }

    private function list(int $priceCents, ?Station $station = null): FrequencyListing
    {
        $station ??= $this->station;

        $this->actingAs($station->owner)
            ->post($this->studioUrl($station, '/vender'), $this->form($priceCents))
            ->assertSessionHasNoErrors();

        return FrequencyListing::query()->active()->where('station_id', $station->id)->sole();
    }

    private function buyerWith(int $cents): User
    {
        $buyer = User::factory()->create();
        $this->ledger->deposit($this->ledger->open($buyer), $cents, new LedgerEntry('seed:'.Str::uuid()));

        return $buyer;
    }

    private function credit(Wallet $wallet, int $cents): void
    {
        $this->ledger->credit($wallet, WalletTransactionType::GiftEarning, $cents, new LedgerEntry('seed:'.Str::uuid()));
    }
}
