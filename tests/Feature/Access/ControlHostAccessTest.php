<?php

namespace Tests\Feature\Access;

use App\Domain\Stations\Enums\StationRole;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ControlHostAccessTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function every_host_answers_the_uptime_probe(): void
    {
        $this->get($this->publicUrl('/up'))->assertOk()->assertSee('OK');
        $this->get($this->consoleUrl('/up'))->assertOk()->assertSee('OK');
        $this->get($this->controlUrl('/up'))->assertOk()->assertSee('OK');
    }

    #[Test]
    public function guests_must_sign_in_on_the_control_host(): void
    {
        $this->get($this->controlUrl('/'))->assertRedirect('/ingresar');
    }

    #[Test]
    public function staff_land_on_the_platform_panel(): void
    {
        $this->actingAs($this->staff())
            ->get($this->controlUrl('/'))
            ->assertRedirect('/admin');
    }

    #[Test]
    public function listeners_are_sent_to_the_public_platform(): void
    {
        $this->actingAs(User::factory()->create())
            ->get($this->controlUrl('/'))
            ->assertRedirect($this->publicUrl('/crear-mi-radio'));
    }

    #[Test]
    public function station_teams_are_sent_to_the_creators_console(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($this->teamMember($station, StationRole::Host))
            ->get($this->controlUrl('/'))
            ->assertRedirect($this->consoleUrl());
    }

    #[Test]
    public function old_studio_links_move_permanently_to_the_console(): void
    {
        $this->get($this->controlUrl('/estudio/89-30/biblioteca?pagina=2'))
            ->assertStatus(301)
            ->assertRedirect($this->consoleUrl('/89-30/biblioteca?pagina=2'));

        $this->get($this->controlUrl('/estudio'))
            ->assertStatus(301)
            ->assertRedirect($this->consoleUrl());
    }

    #[Test]
    public function studios_no_longer_answer_on_the_control_host(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($this->staff())
            ->get($this->controlUrl('/'.$station->frequency->slug))
            ->assertNotFound();
    }

    #[Test]
    public function the_control_host_does_not_offer_registration(): void
    {
        $this->get($this->controlUrl('/registro'))->assertRedirect($this->publicUrl('/registro'));
    }

    #[Test]
    public function suspended_accounts_are_signed_out(): void
    {
        $this->actingAs(User::factory()->suspended()->create())
            ->get($this->controlUrl('/'))
            ->assertRedirect('/ingresar');

        $this->assertGuest();
    }
}
