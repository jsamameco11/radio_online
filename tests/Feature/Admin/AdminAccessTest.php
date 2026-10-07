<?php

namespace Tests\Feature\Admin;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Models\Frequency;
use App\Models\Station;
use App\Models\User;
use Database\Seeders\AccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AdminAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    /** @return array<string, array{string, string}> */
    public static function pages(): array
    {
        return [
            'monitor' => ['/admin/monitor', 'Admin/Monitor'],
            'frequencies' => ['/admin/frecuencias', 'Admin/Frequencies/Index'],
            'expand dial' => ['/admin/frecuencias/ampliar', 'Admin/Frequencies/Expand'],
            'requests' => ['/admin/solicitudes', 'Admin/Requests/Index'],
            'stations' => ['/admin/radios', 'Admin/Stations/Index'],
            'users' => ['/admin/usuarios', 'Admin/Users/Index'],
            'categories' => ['/admin/categorias', 'Admin/Categories/Index'],
            'moderation' => ['/admin/moderacion', 'Admin/Moderation/Index'],
            'audit' => ['/admin/auditoria', 'Admin/Audit/Index'],
            'settings' => ['/admin/configuracion', 'Admin/Settings'],
        ];
    }

    #[Test]
    #[DataProvider('pages')]
    public function super_admins_see_every_admin_page(string $path, string $component): void
    {
        $this->actingAs($this->staff())
            ->get($this->controlUrl($path))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component($component));
    }

    #[Test]
    public function the_dashboard_renders_for_admins(): void
    {
        $this->actingAs($this->staff(PlatformRole::Admin))
            ->get($this->controlUrl('/admin'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Dashboard'));
    }

    #[Test]
    public function the_dashboard_sends_its_figures_first_and_defers_the_charts_and_lists(): void
    {
        $station = Station::factory()->create(['stream_status' => StreamStatus::Live, 'listener_count' => 12]);
        User::factory()->count(2)->create();

        $this->actingAs($this->staff())
            ->get($this->controlUrl('/admin'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Dashboard')
                ->where('kpis.stations', 1)
                ->where('kpis.on_air', 1)
                ->where('kpis.live', 1)
                ->where('kpis.listeners_now', 12)
                ->where('kpis.users', User::query()->count())
                ->has('kpis.gifts_today')
                ->where('dial.total', Frequency::query()->count())
                ->has('alerts', fn (Assert $alerts) => $alerts->has('maintenance')->has('stale_requests'))
                ->missing('series')
                ->missing('topStations')
                ->missing('audit')
                ->loadDeferredProps('charts', fn (Assert $reload) => $reload->has('series', 14))
                ->loadDeferredProps('activity', fn (Assert $reload) => $reload
                    ->where('topStations.0.id', $station->id)
                    ->has('troubled')
                    ->has('audit')));
    }

    #[Test]
    public function non_staff_users_cannot_enter_the_admin_panel(): void
    {
        $this->seed(AccessSeeder::class);

        $this->actingAs(User::factory()->create())
            ->get($this->controlUrl('/admin/radios'))
            ->assertRedirect($this->publicUrl('/crear-mi-radio'));

        $this->actingAs(Station::factory()->create()->owner)
            ->get($this->controlUrl('/admin/radios'))
            ->assertRedirect($this->consoleUrl());
    }

    #[Test]
    public function staff_enter_the_panel_without_two_factor_authentication(): void
    {
        $this->seed(AccessSeeder::class);
        $admin = tap(User::factory()->create())->assignRole(PlatformRole::Admin->value);

        $this->actingAs($admin)
            ->get($this->controlUrl('/admin/radios'))
            ->assertOk();
    }

    #[Test]
    public function moderators_only_reach_their_sections(): void
    {
        $moderator = $this->staff(PlatformRole::Moderator);

        $this->actingAs($moderator)->get($this->controlUrl('/admin/moderacion'))->assertOk();
        $this->actingAs($moderator)->get($this->controlUrl('/admin/radios'))->assertOk();
        $this->actingAs($moderator)->get($this->controlUrl('/admin/monitor'))->assertOk();

        foreach (['/admin/frecuencias', '/admin/solicitudes', '/admin/categorias', '/admin/auditoria', '/admin/configuracion'] as $path) {
            $this->actingAs($moderator)->get($this->controlUrl($path))->assertForbidden();
        }
    }

    #[Test]
    public function admins_cannot_change_platform_settings(): void
    {
        $this->actingAs($this->staff(PlatformRole::Admin))
            ->get($this->controlUrl('/admin/configuracion'))
            ->assertForbidden();
    }
}
