<?php

namespace Tests\Feature\Studio;

use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Stations\Enums\StationRole;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TeamAndSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    #[Test]
    public function owners_add_change_and_remove_members(): void
    {
        $station = Station::factory()->create();
        $user = User::factory()->create();

        $this->actingAs($station->owner)
            ->post($this->studioUrl($station, '/configuracion/equipo'), ['email' => $user->email, 'role' => StationRole::Host->value])
            ->assertSessionHasNoErrors();

        $member = $station->members()->where('user_id', $user->id)->firstOrFail();
        $this->assertSame(StationRole::Host, $member->role);

        $this->actingAs($station->owner)
            ->put($this->studioUrl($station, "/configuracion/equipo/{$member->id}"), ['role' => StationRole::Editor->value])
            ->assertSessionHasNoErrors();

        $this->assertSame(StationRole::Editor, $member->fresh()->role);

        $this->actingAs($station->owner)
            ->delete($this->studioUrl($station, "/configuracion/equipo/{$member->id}"))
            ->assertSessionHasNoErrors();

        $this->assertModelMissing($member);
    }

    #[Test]
    public function nobody_can_be_made_owner_from_the_team_screen(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($station->owner)
            ->post($this->studioUrl($station, '/configuracion/equipo'), ['email' => User::factory()->create()->email, 'role' => StationRole::Owner->value])
            ->assertSessionHasErrors('role');
    }

    #[Test]
    public function managers_see_the_team_but_cannot_change_it(): void
    {
        $station = Station::factory()->create();
        $manager = $this->teamMember($station, StationRole::Manager);

        $this->actingAs($manager)->get($this->studioUrl($station, '/configuracion/equipo'))->assertOk();

        $this->actingAs($manager)
            ->post($this->studioUrl($station, '/configuracion/equipo'), ['email' => User::factory()->create()->email, 'role' => StationRole::Host->value])
            ->assertForbidden();
    }

    #[Test]
    public function members_of_other_stations_cannot_touch_the_team(): void
    {
        $station = Station::factory()->create();
        $other = Station::factory()->create();
        $foreign = $other->members()->firstOrFail();

        $this->actingAs($other->owner)
            ->get($this->studioUrl($station, '/configuracion/equipo'))
            ->assertForbidden();

        $this->actingAs($station->owner)
            ->delete($this->studioUrl($station, "/configuracion/equipo/{$foreign->id}"))
            ->assertNotFound();
    }

    #[Test]
    public function owners_transfer_the_station_with_their_password(): void
    {
        $station = Station::factory()->create();
        $owner = $station->owner;
        $manager = $this->teamMember($station, StationRole::Manager);

        $this->actingAs($owner)
            ->post($this->studioUrl($station, '/configuracion/seguridad/transferir'), ['user_id' => $manager->id, 'password' => 'wrong-password'])
            ->assertSessionHasErrors('password');

        $this->actingAs($owner)
            ->post($this->studioUrl($station, '/configuracion/seguridad/transferir'), ['user_id' => $manager->id, 'password' => 'password'])
            ->assertSessionHasNoErrors();

        $this->assertSame($manager->id, $station->fresh()->owner_id);
    }

    #[Test]
    public function only_owners_close_the_station(): void
    {
        $station = Station::factory()->create();
        $manager = $this->teamMember($station, StationRole::Manager);
        $label = $station->frequency->label;

        $this->actingAs($manager)
            ->post($this->studioUrl($station, '/configuracion/seguridad/cerrar'), ['confirmation' => $label, 'password' => 'password'])
            ->assertForbidden();

        $this->actingAs($station->owner)
            ->post($this->studioUrl($station, '/configuracion/seguridad/cerrar'), ['confirmation' => $label, 'password' => 'password'])
            ->assertSessionHasNoErrors();

        $this->assertSoftDeleted($station);
        $this->assertSame(FrequencyStatus::Reserved, $station->frequency->fresh()->status);
    }

    #[Test]
    public function owners_request_and_cancel_a_frequency_change(): void
    {
        $station = Station::factory()->create();
        $target = Frequency::factory()->create();

        $this->actingAs($station->owner)
            ->post($this->studioUrl($station, '/configuracion/frecuencia'), ['frequency' => $target->label, 'reason' => 'Corto'])
            ->assertSessionHasErrors('reason');

        $this->actingAs($station->owner)
            ->post($this->studioUrl($station, '/configuracion/frecuencia'), ['frequency' => $target->label, 'reason' => 'Queremos una frecuencia más fácil de recordar.'])
            ->assertSessionHasNoErrors();

        $request = FrequencyRequest::query()->where('station_id', $station->id)->firstOrFail();
        $this->assertSame(FrequencyRequestStatus::Pending, $request->status);

        $this->actingAs($station->owner)
            ->delete($this->studioUrl($station, "/configuracion/frecuencia/solicitudes/{$request->id}"))
            ->assertSessionHasNoErrors();

        $this->assertSame(FrequencyRequestStatus::Cancelled, $request->fresh()->status);
    }
}
