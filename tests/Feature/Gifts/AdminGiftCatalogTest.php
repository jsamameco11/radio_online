<?php

namespace Tests\Feature\Gifts;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Gifts\Actions\SendGift;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\AuditLog;
use App\Models\Gift;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AdminGiftCatalogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    #[Test]
    public function the_catalog_requires_gifts_manage(): void
    {
        $this->actingAs($this->staff(PlatformRole::Moderator))
            ->get($this->controlUrl('/admin/regalos'))
            ->assertForbidden();

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->get($this->controlUrl('/admin/regalos'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Gifts/Index'));
    }

    #[Test]
    public function gifts_cost_at_least_one_dollar(): void
    {
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/regalos'), $this->form(price: 99))
            ->assertSessionHasErrors('price_cents');

        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/regalos'), $this->form(price: 100))
            ->assertSessionHasNoErrors();

        $gift = Gift::query()->sole();
        $this->assertSame('girasol', $gift->slug);
        $this->assertSame(1, AuditLog::query()->where('action', 'gift.created')->count());
    }

    #[Test]
    public function a_gift_already_sent_can_only_be_deactivated(): void
    {
        $admin = $this->staff(PlatformRole::Admin);
        $gift = Gift::query()->create(['name' => 'Rosa', 'slug' => 'rosa', 'emoji' => '🌹', 'price_cents' => 100]);
        $listener = User::factory()->create();
        $ledger = app(WalletLedger::class);
        $ledger->deposit($ledger->open($listener), 500, new LedgerEntry('seed'));
        app(SendGift::class)->handle($listener, Station::factory()->create(), $gift, 1, (string) Str::uuid());

        $this->actingAs($admin)
            ->delete($this->controlUrl('/admin/regalos/'.$gift->id))
            ->assertSessionHas('error');
        $this->assertModelExists($gift);

        $this->actingAs($admin)
            ->put($this->controlUrl('/admin/regalos/'.$gift->id), [...$this->form(price: 150), 'name' => 'Rosa', 'active' => false])
            ->assertSessionHasNoErrors();
        $this->assertFalse($gift->fresh()->active);
        $this->assertSame(150, $gift->fresh()->price_cents);
    }

    /**
     * @return array<string, mixed>
     */
    private function form(int $price): array
    {
        return ['name' => 'Girasol', 'emoji' => '🌻', 'price_cents' => $price, 'animation' => 'float', 'sort_order' => 3, 'active' => true];
    }
}
