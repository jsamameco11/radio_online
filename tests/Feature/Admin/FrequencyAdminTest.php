<?php

namespace Tests\Feature\Admin;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\Station;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FrequencyAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    #[Test]
    public function admins_reserve_and_release_free_frequencies(): void
    {
        $frequency = Frequency::factory()->create();
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)
            ->get($this->controlUrl("/admin/frecuencias/{$frequency->slug}"))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Frequencies/Show'));

        $this->actingAs($admin)
            ->post($this->controlUrl("/admin/frecuencias/{$frequency->slug}/reservar"), ['note' => 'Para la radio municipal'])
            ->assertSessionHasNoErrors();

        $this->assertSame(FrequencyStatus::Reserved, $frequency->fresh()->status);

        $this->actingAs($admin)
            ->post($this->controlUrl("/admin/frecuencias/{$frequency->slug}/liberar"))
            ->assertSessionHasNoErrors();

        $this->assertSame(FrequencyStatus::Available, $frequency->fresh()->status);
    }

    #[Test]
    public function an_active_frequency_cannot_be_reserved(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl("/admin/frecuencias/{$station->frequency->slug}/reservar"))
            ->assertSessionHasErrors();

        $this->assertSame(FrequencyStatus::Active, $station->frequency->fresh()->status);
    }

    #[Test]
    public function approving_a_change_request_moves_the_station(): void
    {
        $station = Station::factory()->create();
        $old = $station->frequency;
        $target = Frequency::factory()->create();
        $request = $this->changeRequest($station, $target);

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl("/admin/solicitudes/{$request->id}/aprobar"))
            ->assertSessionHasNoErrors();

        $this->assertSame(FrequencyRequestStatus::Approved, $request->fresh()->status);
        $this->assertSame($target->id, $station->fresh()->frequency_id);
        $this->assertSame(FrequencyStatus::Active, $target->fresh()->status);
        $this->assertSame(FrequencyStatus::Available, $old->fresh()->status);
    }

    #[Test]
    public function the_pending_list_offers_every_free_frequency(): void
    {
        $station = Station::factory()->create();
        $this->changeRequest($station, Frequency::factory()->create());

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->get($this->controlUrl('/admin/solicitudes'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Requests/Index')
                ->where('freeFrequencies', Frequency::freeOptions()));
    }

    #[Test]
    public function approving_can_assign_another_free_frequency_and_keeps_the_note(): void
    {
        $station = Station::factory()->create();
        $target = Frequency::factory()->create();
        $other = Frequency::factory()->create();
        $request = $this->changeRequest($station, $target);
        $note = '¡Felicitaciones! Has obtenido tu frecuencia en vivo. Utilízala con responsabilidad.';

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl("/admin/solicitudes/{$request->id}/aprobar"), [
                'frequency' => $other->label,
                'note' => $note,
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame($other->id, $station->fresh()->frequency_id);
        $this->assertSame(FrequencyStatus::Available, $target->fresh()->status);
        $this->assertSame(FrequencyStatus::Active, $other->fresh()->status);
        $this->assertSame($note, $request->fresh()->review_note);
    }

    #[Test]
    public function rejecting_requires_a_note(): void
    {
        $station = Station::factory()->create();
        $request = $this->changeRequest($station, Frequency::factory()->create());
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)
            ->post($this->controlUrl("/admin/solicitudes/{$request->id}/rechazar"))
            ->assertSessionHasErrors('note');

        $this->actingAs($admin)
            ->post($this->controlUrl("/admin/solicitudes/{$request->id}/rechazar"), ['note' => 'Esa frecuencia está reservada.'])
            ->assertSessionHasNoErrors();

        $this->assertSame(FrequencyRequestStatus::Rejected, $request->fresh()->status);
    }

    #[Test]
    public function moderators_cannot_manage_frequencies(): void
    {
        $frequency = Frequency::factory()->create();

        $this->actingAs($this->staff(PlatformRole::Moderator))
            ->post($this->controlUrl("/admin/frecuencias/{$frequency->slug}/reservar"))
            ->assertForbidden();
    }

    private function changeRequest(Station $station, Frequency $target): FrequencyRequest
    {
        $request = new FrequencyRequest([
            'user_id' => $station->owner_id,
            'station_id' => $station->id,
            'frequency_id' => $target->id,
            'station_name' => $station->name,
            'category_ids' => [],
            'pitch' => 'Queremos una frecuencia más fácil de recordar.',
            'status' => FrequencyRequestStatus::Pending,
        ]);
        $request->forceFill(['kind' => FrequencyRequestKind::FrequencyChange->value])->save();

        return $request;
    }
}
