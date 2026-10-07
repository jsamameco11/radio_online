<?php

namespace Tests\Feature\Wallet;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\WalletLedger;
use App\Models\AuditLog;
use App\Models\Station;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AdminLedgerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    #[Test]
    public function the_ledger_requires_payments_view(): void
    {
        $this->actingAs($this->staff(PlatformRole::Moderator))
            ->get($this->controlUrl('/admin/movimientos'))
            ->assertForbidden();

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->get($this->controlUrl('/admin/movimientos'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Ledger/Index')->where('canAdjust', false));
    }

    #[Test]
    public function adjustments_require_wallets_adjust(): void
    {
        $listener = User::factory()->create();

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl('/admin/movimientos/ajustes'), $this->adjustment($listener->email, 500))
            ->assertForbidden();

        $this->assertSame(0, WalletTransaction::query()->count());
    }

    #[Test]
    public function a_super_admin_adjusts_a_listener_wallet_with_an_audited_reason(): void
    {
        $listener = User::factory()->create();
        $form = $this->adjustment($listener->email, 500);

        $this->actingAs($this->staff())
            ->post($this->controlUrl('/admin/movimientos/ajustes'), $form)
            ->assertSessionHasNoErrors();
        $this->post($this->controlUrl('/admin/movimientos/ajustes'), $form);

        $this->assertSame(500, app(WalletLedger::class)->balance($listener));
        $this->assertSame(1, WalletTransaction::query()->where('type', WalletTransactionType::AdminAdjustment->value)->count());
        $this->assertSame(1, AuditLog::query()->where('action', 'wallet.adjusted')->count());
    }

    #[Test]
    public function station_wallets_are_found_by_frequency_and_a_reason_is_required(): void
    {
        $station = Station::factory()->create();
        $staff = $this->staff();

        $this->actingAs($staff)
            ->post($this->controlUrl('/admin/movimientos/ajustes'), [...$this->adjustment($station->frequency->label, 300, 'station'), 'reason' => ''])
            ->assertSessionHasErrors('reason');

        $this->actingAs($staff)
            ->post($this->controlUrl('/admin/movimientos/ajustes'), $this->adjustment('00.00', 300, 'station'))
            ->assertSessionHasErrors('owner');

        $this->actingAs($staff)
            ->post($this->controlUrl('/admin/movimientos/ajustes'), $this->adjustment($station->frequency->label, 300, 'station'))
            ->assertSessionHasNoErrors();

        $this->assertSame(300, app(WalletLedger::class)->balance($station));
    }

    /**
     * @return array<string, mixed>
     */
    private function adjustment(string $owner, int $cents, string $type = 'user', ?string $reason = 'Compensación por corte del servicio'): array
    {
        return [
            'owner_type' => $type,
            'owner' => $owner,
            'amount_cents' => $cents,
            'reason' => $reason,
            'idempotency_key' => (string) Str::uuid(),
        ];
    }
}
