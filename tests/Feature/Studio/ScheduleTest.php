<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Broadcast\BroadcastClock;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\ScheduleSlot;
use App\Models\Station;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ScheduleTest extends TestCase
{
    use LibraryFixtures, RefreshDatabase;

    private Station $station;

    private User $editor;

    private string $tomorrow;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeMedia();
        $this->station = Station::factory()->create();
        $this->editor = $this->teamMember($this->station, StationRole::Editor);
        $this->tomorrow = CarbonImmutable::now(BroadcastClock::timezone())->addDay()->toDateString();
    }

    private function schedule(string $path = ''): string
    {
        return $this->studioUrl($this->station, '/programacion'.$path);
    }

    private function slots(Station $station)
    {
        return app(CurrentStation::class)->within($station, fn () => ScheduleSlot::query()->orderBy('starts_at')->get());
    }

    #[Test]
    public function the_schedule_shows_the_blocks_of_the_chosen_day(): void
    {
        $track = $this->storedTrack($this->station, ['title' => 'Pedro Navaja']);
        $this->actingAs($this->editor)->postJson($this->schedule('/bloques'), [
            'type' => 'tracks', 'tracks' => [$track->id], 'date' => $this->tomorrow, 'mode' => 'at', 'time' => '18:30', 'layer' => 0,
        ])->assertOk();

        $this->actingAs($this->editor)->get($this->schedule('?dia='.$this->tomorrow))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Schedule')
                ->where('date', $this->tomorrow)
                ->where('bounds', BroadcastClock::dayBounds($this->tomorrow))
                ->has('blocks', 1)
                ->where('blocks.0.title', 'Pedro Navaja')
                ->has('days', 21)
                ->has('layers', 4));
    }

    #[Test]
    public function the_schedule_is_closed_to_other_stations_and_to_members_without_the_permission(): void
    {
        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->get($this->schedule())->assertForbidden();
        $this->actingAs($this->teamMember(Station::factory()->create(), StationRole::Owner))
            ->postJson($this->schedule('/bloques'), ['type' => 'live'])->assertForbidden();
    }

    #[Test]
    public function audios_are_placed_one_after_another_at_the_chosen_time(): void
    {
        $first = $this->storedTrack($this->station, ['title' => 'Pedro Navaja', 'duration' => 300]);
        $second = $this->storedTrack($this->station, ['title' => 'Plástico', 'duration' => 120]);

        $this->actingAs($this->editor)->postJson($this->schedule('/bloques'), [
            'type' => 'tracks', 'tracks' => [$first->id, $second->id], 'date' => $this->tomorrow, 'mode' => 'at', 'time' => '18:30', 'layer' => 0,
        ])->assertOk()->assertJsonPath('message', '2 bloques programados de 18:30:00 a 18:37:00.');

        $slots = $this->slots($this->station);
        $this->assertCount(2, $slots);
        $start = BroadcastClock::at($this->tomorrow, '18:30');
        $this->assertSame($start, $slots[0]->starts_at->getTimestampMs());
        $this->assertSame($start + 300000, $slots[1]->starts_at->getTimestampMs());
    }

    #[Test]
    public function blocks_of_the_main_program_never_overlap(): void
    {
        $this->actingAs($this->editor)->postJson($this->schedule('/bloques'), [
            'type' => 'live', 'title' => 'Mañanas al día', 'minutes' => 60, 'date' => $this->tomorrow, 'mode' => 'at', 'time' => '08:00', 'layer' => 0,
        ])->assertOk();

        $this->actingAs($this->editor)->postJson($this->schedule('/bloques'), [
            'type' => 'live', 'title' => 'Tarde', 'minutes' => 30, 'date' => $this->tomorrow, 'mode' => 'at', 'time' => '08:30', 'layer' => 0,
        ])->assertStatus(422)->assertJsonPath('message', fn (string $message) => str_contains($message, 'Mañanas al día'));

        $this->actingAs($this->editor)->postJson($this->schedule('/bloques'), [
            'type' => 'live', 'title' => 'Tarde', 'minutes' => 30, 'date' => $this->tomorrow, 'mode' => 'at', 'time' => '08:30', 'layer' => 2,
        ])->assertJsonValidationErrors('layer');
    }

    #[Test]
    public function a_period_of_automatic_music_is_placed_on_the_main_program(): void
    {
        $this->actingAs($this->editor)->postJson($this->schedule('/bloques'), [
            'type' => 'auto', 'date' => $this->tomorrow, 'mode' => 'at', 'time' => '06:00', 'until' => '08:00', 'layer' => 0,
        ])->assertOk()->assertJsonPath('message', 'Música automática de 06:00:00 a 08:00:00: canciones aleatorias.');

        $slot = $this->slots($this->station)->sole();
        $this->assertSame(ScheduleSlot::AUTO, $slot->kind);
        $this->assertEquals(7200, $slot->duration);
    }

    #[Test]
    public function a_block_is_edited_moved_and_removed(): void
    {
        $this->actingAs($this->editor)->postJson($this->schedule('/bloques'), [
            'type' => 'live', 'title' => 'Mañanas al día', 'minutes' => 60, 'date' => $this->tomorrow, 'mode' => 'at', 'time' => '08:00', 'layer' => 0,
        ])->assertOk();
        $slot = $this->slots($this->station)->sole();

        $this->actingAs($this->editor)->putJson($this->schedule('/bloques/'.$slot->id), ['time' => '09:00', 'minutes' => 90, 'title' => 'Mañanas'])
            ->assertOk();
        $slot->refresh();
        $this->assertSame('Mañanas', $slot->title);
        $this->assertEquals(5400, $slot->duration);
        $this->assertSame(BroadcastClock::at($this->tomorrow, '09:00'), $slot->starts_at->getTimestampMs());

        $this->actingAs($this->editor)->deleteJson($this->schedule('/bloques/'.$slot->id))->assertOk();
        $this->assertCount(0, $this->slots($this->station));
    }

    #[Test]
    public function blocks_of_another_station_cannot_be_touched(): void
    {
        $other = Station::factory()->create();
        $this->actingAs($this->teamMember($other, StationRole::Editor))->postJson($this->studioUrl($other, '/programacion/bloques'), [
            'type' => 'live', 'title' => 'Ajeno', 'minutes' => 30, 'date' => $this->tomorrow, 'mode' => 'at', 'time' => '10:00', 'layer' => 0,
        ])->assertOk();
        $foreign = $this->slots($other)->sole();

        $this->actingAs($this->editor)->deleteJson($this->schedule('/bloques/'.$foreign->id))->assertNotFound();
        $this->actingAs($this->editor)->putJson($this->schedule('/bloques/'.$foreign->id), ['title' => 'Mío'])->assertNotFound();
        $this->assertCount(1, $this->slots($other));
    }

    #[Test]
    public function a_day_is_copied_to_other_days_and_cleared(): void
    {
        $this->actingAs($this->editor)->postJson($this->schedule('/bloques'), [
            'type' => 'live', 'title' => 'Mañanas al día', 'minutes' => 60, 'date' => $this->tomorrow, 'mode' => 'at', 'time' => '08:00', 'layer' => 0,
        ])->assertOk();
        $after = CarbonImmutable::parse($this->tomorrow)->addDay()->toDateString();

        $this->actingAs($this->editor)->postJson($this->schedule('/copiar'), ['date' => $this->tomorrow, 'targets' => [$after]])
            ->assertOk()->assertJsonPath('message', 'Se copiaron 1 bloques a 1 día(s).');
        $this->assertCount(2, $this->slots($this->station));

        $this->actingAs($this->editor)->deleteJson($this->schedule('/dias/'.$after))
            ->assertOk()->assertJsonPath('message', 'Se quitaron 1 bloques del día.');
        $this->assertCount(1, $this->slots($this->station));
    }

    #[Test]
    public function the_program_resolves_the_automatic_music_song_by_song(): void
    {
        $this->storedTrack($this->station, ['title' => 'Pedro Navaja', 'duration' => 200]);
        $this->storedTrack($this->station, ['title' => 'Plástico', 'duration' => 200]);
        $this->storedTrack($this->station, ['kind' => TrackKind::Jingle, 'title' => 'Identificación', 'duration' => 6]);
        app(CurrentStation::class)->within($this->station, fn () => app(PlayoutCaches::class)->flush());
        $from = BroadcastClock::at($this->tomorrow, '10:00');

        $items = $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->getJson($this->schedule('/linea?desde='.$from.'&hasta='.($from + 3600000)))
            ->assertOk()
            ->json('items');

        $this->assertNotEmpty($items);
        $this->assertSame([], array_values(array_diff(array_unique(array_column($items, 'title')), ['Pedro Navaja', 'Plástico'])));
        $this->assertSame($from, $items[0]['start']);

        $this->actingAs($this->editor)->getJson($this->schedule('/linea?desde='.$from.'&hasta='.($from + 40 * 3600000)))
            ->assertJsonValidationErrors('hasta');
    }

    #[Test]
    public function the_automatic_music_is_switched_from_the_schedule(): void
    {
        $this->storedTrack($this->station, ['title' => 'Pedro Navaja', 'duration' => 200]);
        app(CurrentStation::class)->within($this->station, fn () => app(PlayoutCaches::class)->flush());

        $this->actingAs($this->editor)->putJson($this->schedule('/musica/repetir'), ['on' => false])
            ->assertOk()
            ->assertJsonPath('snapshot.autopilot.repeat', false);
        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->putJson($this->schedule('/musica/repetir'), ['on' => true])
            ->assertForbidden();
    }
}
