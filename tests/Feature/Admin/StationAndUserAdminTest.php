<?php

namespace Tests\Feature\Admin;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Stations\Enums\StationStatus;
use App\Models\AuditLog;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StationAndUserAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    #[Test]
    public function stations_are_listed_and_shown(): void
    {
        $station = Station::factory()->create(['name' => 'Radio Aurora']);
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)
            ->get($this->controlUrl('/admin/radios?q=Aurora'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Stations/Index')->has('stations.data', 1));

        $this->actingAs($admin)
            ->get($this->controlUrl("/admin/radios/{$station->id}"))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Stations/Show')->where('station.id', $station->id));
    }

    #[Test]
    public function admins_suspend_and_reactivate_stations_with_a_reason(): void
    {
        $station = Station::factory()->create();
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)
            ->post($this->controlUrl("/admin/radios/{$station->id}/suspender"), ['reason' => 'no'])
            ->assertSessionHasErrors('reason');

        $this->actingAs($admin)
            ->post($this->controlUrl("/admin/radios/{$station->id}/suspender"), ['reason' => 'Contenido con derechos de autor'])
            ->assertSessionHasNoErrors();

        $this->assertSame(StationStatus::Suspended, $station->fresh()->status);
        $this->assertTrue(AuditLog::query()->where('action', 'station.suspended')->exists());

        $this->actingAs($admin)
            ->post($this->controlUrl("/admin/radios/{$station->id}/reactivar"))
            ->assertSessionHasNoErrors();

        $this->assertSame(StationStatus::Active, $station->fresh()->status);
    }

    #[Test]
    public function moderators_cannot_suspend_stations(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($this->staff(PlatformRole::Moderator))
            ->post($this->controlUrl("/admin/radios/{$station->id}/suspender"), ['reason' => 'Contenido con derechos de autor'])
            ->assertForbidden();

        $this->assertSame(StationStatus::Active, $station->fresh()->status);
    }

    #[Test]
    public function admins_suspend_users_but_only_super_admins_change_roles(): void
    {
        $user = User::factory()->create();
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)
            ->get($this->controlUrl("/admin/usuarios/{$user->id}"))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Users/Show'));

        $this->actingAs($admin)
            ->post($this->controlUrl("/admin/usuarios/{$user->id}/suspender"), ['reason' => 'Spam repetido en mensajes'])
            ->assertSessionHasNoErrors();

        $this->assertNotNull($user->fresh()->suspended_at);

        $this->actingAs($admin)
            ->put($this->controlUrl("/admin/usuarios/{$user->id}/rol"), ['role' => PlatformRole::Moderator->value])
            ->assertForbidden();

        $this->actingAs($this->staff())
            ->put($this->controlUrl("/admin/usuarios/{$user->id}/rol"), ['role' => PlatformRole::Moderator->value])
            ->assertSessionHasNoErrors();

        $this->assertTrue($user->fresh()->hasRole(PlatformRole::Moderator->value));
    }

    #[Test]
    public function moderators_cannot_suspend_users(): void
    {
        $user = User::factory()->create();

        $this->actingAs($this->staff(PlatformRole::Moderator))
            ->post($this->controlUrl("/admin/usuarios/{$user->id}/suspender"), ['reason' => 'Spam repetido en mensajes'])
            ->assertForbidden();
    }
}
