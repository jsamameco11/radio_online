<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Domain\Streaming\Events\StreamStarted;
use App\Domain\Streaming\Events\StreamStopped;
use App\Domain\Studio\Broadcast\LiveDesk;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\AuditLog;
use App\Models\Station;
use App\Models\StreamSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ConsoleTest extends TestCase
{
    use LibraryFixtures, RefreshDatabase;

    private Station $station;

    private User $host;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeMedia();
        $this->station = Station::factory()->create();
        $this->host = $this->teamMember($this->station, StationRole::Host);
    }

    private function console(string $path = ''): string
    {
        return $this->studioUrl($this->station, '/consola'.$path);
    }

    #[Test]
    public function a_host_opens_the_console_of_their_station(): void
    {
        $this->storedTrack($this->station, ['kind' => TrackKind::Effect, 'title' => 'Aplausos', 'duration' => 4]);

        $this->actingAs($this->host)->get($this->console())
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Console')
                ->where('snapshot.radio.station.id', $this->station->id)
                ->where('snapshot.radio.on_air', false)
                ->where('snapshot.live.session', null)
                ->has('pads', 1)
                ->where('pads.0.title', 'Aplausos')
                ->has('library', 1)
                ->where('canSchedule', false));
    }

    #[Test]
    public function the_console_is_closed_to_other_stations_and_to_members_without_the_permission(): void
    {
        $this->actingAs($this->teamMember(Station::factory()->create(), StationRole::Owner))
            ->get($this->console())->assertForbidden();
        $this->actingAs($this->teamMember($this->station, StationRole::Editor))
            ->get($this->console())->assertForbidden();
        $this->actingAs($this->teamMember($this->station, StationRole::Editor))
            ->postJson($this->console('/vivo'))->assertForbidden();
        $this->actingAs($this->teamMember(Station::factory()->create(), StationRole::Owner))
            ->putJson($this->console('/aire'), ['on' => true])->assertForbidden();
    }

    #[Test]
    public function opening_the_live_session_puts_the_station_on_the_air_live(): void
    {
        Event::fake([StreamStarted::class, StreamStopped::class]);

        $response = $this->actingAs($this->host)->postJson($this->console('/vivo'), ['title' => 'Mañanas al día'])
            ->assertOk()
            ->assertJsonPath('snapshot.radio.on_air', true)
            ->assertJsonPath('snapshot.radio.live.on', true)
            ->assertJsonPath('snapshot.radio.live.title', 'Mañanas al día')
            ->assertJsonPath('snapshot.live.host', $this->host->name);

        $this->assertNotNull($response->json('snapshot.live.session'));
        $this->assertSame(StreamStatus::Live, $this->station->refresh()->stream_status);
        $this->assertDatabaseHas(StreamSession::class, ['station_id' => $this->station->id, 'host_id' => $this->host->id, 'title' => 'Mañanas al día', 'ended_at' => null]);
        $this->assertDatabaseHas(AuditLog::class, ['action' => 'broadcast.live_started', 'station_id' => $this->station->id]);
        Event::assertDispatched(StreamStarted::class, fn (StreamStarted $event) => $event->stationId === $this->station->id);

        $this->actingAs($this->host)->deleteJson($this->console('/vivo'))
            ->assertOk()
            ->assertJsonPath('snapshot.live.session', null)
            ->assertJsonPath('snapshot.radio.live.on', false);

        $this->assertSame(StreamStatus::Online, $this->station->refresh()->stream_status);
        $this->assertNotNull(StreamSession::query()->where('station_id', $this->station->id)->value('ended_at'));
        Event::assertDispatched(StreamStopped::class);
    }

    #[Test]
    public function taking_the_station_off_the_air_ends_the_live_session(): void
    {
        $this->actingAs($this->host)->postJson($this->console('/vivo'))->assertOk();

        $this->actingAs($this->host)->putJson($this->console('/aire'), ['on' => false])
            ->assertOk()
            ->assertJsonPath('snapshot.radio.on_air', false)
            ->assertJsonPath('snapshot.live.session', null);

        $this->assertSame(StreamStatus::Offline, $this->station->refresh()->stream_status);
        $this->assertDatabaseHas(AuditLog::class, ['action' => 'broadcast.off_air']);
    }

    #[Test]
    public function the_microphone_needs_an_open_live_session(): void
    {
        $this->actingAs($this->host)->putJson($this->console('/mezcla'), ['mic' => true])
            ->assertStatus(409)
            ->assertJsonPath('message', 'Abre la transmisión en vivo para hablar al aire.');

        $this->actingAs($this->host)->postJson($this->console('/vivo'))->assertOk();
        $this->actingAs($this->host)->putJson($this->console('/mezcla'), ['mic' => true, 'music' => 40])
            ->assertOk()
            ->assertJsonPath('snapshot.live.mic', true)
            ->assertJsonPath('snapshot.live.music', 40)
            ->assertJsonPath('snapshot.radio.live.mic', true);
    }

    #[Test]
    public function a_pad_plays_on_top_of_the_program_for_every_listener(): void
    {
        $track = $this->storedTrack($this->station, ['kind' => TrackKind::Effect, 'title' => 'Aplausos', 'duration' => 4]);
        $this->actingAs($this->host)->putJson($this->console('/aire'), ['on' => true])->assertOk();

        $response = $this->actingAs($this->host)->postJson($this->console('/capas'), ['track' => $track->id, 'lane' => 'pad', 'volume' => 80])
            ->assertOk()
            ->assertJsonPath('layer.track_id', $track->id)
            ->assertJsonPath('snapshot.radio.layers.0.title', 'Aplausos');

        $layer = $response->json('layer.id');
        $this->actingAs($this->host)->patchJson($this->console('/capas/'.$layer), ['volume' => 50, 'duck' => true])
            ->assertOk()
            ->assertJsonPath('layer.volume', 50);

        $this->actingAs($this->host)->deleteJson($this->console('/capas'), ['layer' => $layer])
            ->assertOk()
            ->assertJsonCount(0, 'snapshot.radio.layers');
    }

    #[Test]
    public function audios_of_another_station_cannot_be_fired(): void
    {
        $foreign = $this->storedTrack(Station::factory()->create(), ['kind' => TrackKind::Effect, 'duration' => 4]);

        $this->actingAs($this->host)->postJson($this->console('/capas'), ['track' => $foreign->id, 'lane' => 'A'])
            ->assertNotFound();
        $this->actingAs($this->host)->postJson($this->console('/capas'), ['track' => $foreign->id, 'lane' => 'Z'])
            ->assertJsonValidationErrors('lane');
    }

    #[Test]
    public function the_pad_bank_keeps_the_order_the_operator_chose(): void
    {
        $first = $this->storedTrack($this->station, ['kind' => TrackKind::Jingle, 'title' => 'Identificación', 'duration' => 6]);
        $second = $this->storedTrack($this->station, ['kind' => TrackKind::Effect, 'title' => 'Aplausos', 'duration' => 4]);
        $foreign = $this->storedTrack(Station::factory()->create(), ['kind' => TrackKind::Effect, 'duration' => 4]);

        $this->actingAs($this->host)->putJson($this->console('/botonera'), ['tracks' => [$second->id, $foreign->id, $first->id]])
            ->assertOk()
            ->assertJsonCount(2, 'pads')
            ->assertJsonPath('pads.0.title', 'Aplausos')
            ->assertJsonPath('pads.1.title', 'Identificación');
    }

    #[Test]
    public function the_automatic_music_starts_from_the_console(): void
    {
        $this->actingAs($this->host)->postJson($this->console('/musica'))
            ->assertStatus(409)
            ->assertJsonPath('message', 'No hay canciones disponibles para el modo automático. Sube música a la biblioteca.');

        $this->storedTrack($this->station, ['title' => 'Pedro Navaja']);
        $this->storedTrack($this->station, ['title' => 'Plástico']);
        app(CurrentStation::class)->within($this->station, fn () => app(PlayoutCaches::class)->flush());

        $this->actingAs($this->host)->postJson($this->console('/musica'), ['repeat' => true])
            ->assertOk()
            ->assertJsonPath('snapshot.radio.on_air', true)
            ->assertJsonPath('snapshot.autopilot.mode', 'random')
            ->assertJsonPath('snapshot.autopilot.paused', false);

        $this->travel(10)->seconds();
        $this->actingAs($this->host)->getJson($this->console('/senal'))
            ->assertOk()
            ->assertJsonPath('snapshot.radio.queue.0.kind', 'song')
            ->assertJsonPath('signal', null);

        $this->actingAs($this->host)->putJson($this->console('/musica/continua'), ['on' => false])
            ->assertOk()
            ->assertJsonPath('snapshot.autopilot.paused', true);
    }

    #[Test]
    public function the_live_cut_needs_the_microphone_open(): void
    {
        $this->actingAs($this->host)->putJson($this->console('/aire'), ['on' => true])->assertOk();
        $this->actingAs($this->host)->postJson($this->console('/corte'))->assertStatus(409);

        $this->actingAs($this->host)->postJson($this->console('/vivo'))->assertOk();
        $this->actingAs($this->host)->postJson($this->console('/corte'))
            ->assertOk()
            ->assertJsonPath('snapshot.radio.live.cut', true);

        $this->actingAs($this->host)->deleteJson($this->console('/corte'))
            ->assertOk()
            ->assertJsonPath('snapshot.radio.live.cut', false);
    }

    #[Test]
    public function the_operator_connects_each_listener_to_the_microphone(): void
    {
        $session = $this->actingAs($this->host)->postJson($this->console('/vivo'))->json('snapshot.live.session');
        $listener = User::factory()->create();
        $id = '6f0d8a52-3b1c-4c8e-9a51-0d3f4c2b9e10';
        $radio = $this->publicUrl('/radio/'.$this->station->frequency->slug);

        $this->actingAs($listener)->postJson($radio.'/voz', ['oyente' => $id, 'session' => $session])->assertOk();

        $this->actingAs($this->host)->getJson($this->console('/senal'))
            ->assertOk()
            ->assertJsonPath('signal.pending', [$id]);
        $this->actingAs($this->host)->postJson($this->console('/senal/oferta'), ['id' => $id, 'sdp' => 'v=0 offer'])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->actingAs($listener)->getJson($radio.'/estado?oyente='.$id)
            ->assertOk()
            ->assertJsonPath('voice.state', 'offered')
            ->assertJsonPath('voice.offer', 'v=0 offer');
        $this->actingAs($listener)->postJson($radio.'/voz/respuesta', ['oyente' => $id, 'session' => $session, 'sdp' => 'v=0 answer'])->assertOk();

        $this->actingAs($this->host)->getJson($this->console('/senal'))
            ->assertOk()
            ->assertJsonPath('signal.answers.0.answer', 'v=0 answer')
            ->assertJsonPath('snapshot.voice', 0);
        $this->actingAs($this->host)->getJson($this->console('/senal'))->assertJsonPath('snapshot.voice', 1);
    }

    #[Test]
    public function only_the_host_of_the_session_connects_listeners(): void
    {
        $this->actingAs($this->host)->postJson($this->console('/vivo'))->assertOk();
        $other = $this->teamMember($this->station, StationRole::Host);

        $this->actingAs($other)->getJson($this->console('/senal'))->assertOk()->assertJsonPath('signal', null);
        $this->actingAs($other)->postJson($this->console('/senal/oferta'), ['id' => '6f0d8a52-3b1c-4c8e-9a51-0d3f4c2b9e10', 'sdp' => 'v=0'])
            ->assertStatus(409);
    }

    #[Test]
    public function a_live_session_whose_console_went_silent_ends_by_itself(): void
    {
        $this->actingAs($this->host)->postJson($this->console('/vivo'))->assertOk();

        $this->travel(LiveDesk::OPERATOR_TIMEOUT + 5)->seconds();
        $this->artisan('streaming:sweep')->assertSuccessful();

        $this->assertNull(app(CurrentStation::class)->within($this->station, fn () => app(LiveDesk::class)->stored()['session']));
        $this->assertSame(StreamStatus::Online, $this->station->refresh()->stream_status);
    }

    #[Test]
    public function a_recording_starts_only_with_the_live_session_open(): void
    {
        $this->actingAs($this->host)->postJson($this->console('/grabacion'), ['session' => 'abcdefghijklmnopqrstuvwx'])
            ->assertStatus(409);

        $session = $this->actingAs($this->host)->postJson($this->console('/vivo'))->json('snapshot.live.session');
        $id = $this->actingAs($this->host)->postJson($this->console('/grabacion'), ['session' => $session])
            ->assertOk()
            ->assertJsonPath('recording.status', 'recording')
            ->json('recording.id');

        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->postJson($this->console('/grabacion/'.$id.'/fin'), ['duration' => 10])
            ->assertNotFound();
        $this->actingAs($this->host)->deleteJson($this->console('/grabacion/'.$id))->assertOk();
    }
}
