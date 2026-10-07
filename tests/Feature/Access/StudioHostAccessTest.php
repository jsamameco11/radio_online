<?php

namespace Tests\Feature\Access;

use App\Domain\Stations\Enums\StationRole;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StudioHostAccessTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function guests_must_sign_in_on_the_console(): void
    {
        $this->get($this->consoleUrl('/'))->assertRedirect('/ingresar');

        $this->get($this->consoleUrl('/ingresar'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Auth/Login')
                ->where('app.host', 'studio'));
    }

    #[Test]
    public function listeners_are_invited_to_create_a_radio(): void
    {
        $this->actingAs(User::factory()->create())
            ->get($this->consoleUrl('/'))
            ->assertRedirect($this->publicUrl('/obten-tu-frecuencia'));
    }

    #[Test]
    public function a_member_of_one_station_goes_straight_to_its_studio(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($station->owner)
            ->get($this->consoleUrl('/'))
            ->assertRedirect($this->studioUrl($station));

        $this->actingAs($station->owner)
            ->get($this->studioUrl($station))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Studio/Dashboard')->where('app.host', 'studio'));
    }

    #[Test]
    public function a_member_of_several_stations_picks_one(): void
    {
        $first = Station::factory()->create(['name' => 'Radio Aurora']);
        $second = Station::factory()->create(['name' => 'Radio Brisa']);
        $second->members()->create(['user_id' => $first->owner_id, 'role' => StationRole::Host]);

        $this->actingAs($first->owner)
            ->get($this->consoleUrl('/'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/ChooseStation')
                ->has('stations', 2)
                ->where('stations.0.station.name', 'Radio Aurora')
                ->where('stations.0.role', StationRole::Owner->label())
                ->where('stations.1.role', StationRole::Host->label())
                ->where('stations.1.listen_url', $this->publicUrl('/radio/'.$second->frequency->slug))
                ->where('adminUrl', null)
                ->where('createUrl', $this->publicUrl('/obten-tu-frecuencia')));
    }

    #[Test]
    public function staff_reach_the_console_and_supervise_any_studio(): void
    {
        $staff = $this->staff();
        $station = Station::factory()->create();

        $this->actingAs($staff)
            ->get($this->consoleUrl('/'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/ChooseStation')
                ->has('stations', 0)
                ->where('adminUrl', $this->controlUrl('/admin')));

        $this->actingAs($staff)->get($this->studioUrl($station))->assertOk();
    }

    #[Test]
    public function the_platform_panel_is_not_on_the_console(): void
    {
        $this->actingAs($this->staff())
            ->get($this->consoleUrl('/admin'))
            ->assertNotFound();
    }

    #[Test]
    public function account_pages_answer_on_the_console(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($station->owner)
            ->get($this->consoleUrl('/cuenta/perfil'))
            ->assertOk();
    }

    #[Test]
    public function public_pages_link_the_team_to_its_console(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($station->owner)
            ->get($this->publicUrl('/radio/'.$station->frequency->slug))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('app.host', 'public')
                ->where('app.urls.studio', config('platform.urls.studio'))
                ->where('studioUrl', $this->studioUrl($station)));
    }
}
