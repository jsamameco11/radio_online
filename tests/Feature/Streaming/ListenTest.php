<?php

namespace Tests\Feature\Streaming;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Streaming\Audience;
use App\Domain\Streaming\Events\ListenerCountChanged;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Jobs\VerifyTrackFile;
use App\Models\ListenerSession;
use App\Models\Station;
use App\Models\Track;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ListenTest extends TestCase
{
    use RefreshDatabase;

    private const LISTENER = '6f0d8a52-3b1c-4c8e-9a51-0d3f4c2b9e10';

    private Station $station;

    private User $listener;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake((string) config('filesystems.media.public'));
        $this->station = Station::factory()->create();
        $this->listener = User::factory()->create();
    }

    /** A player beats again once it played long enough to count. */
    private function keepListening(?User $user = null): void
    {
        $this->travel(Audience::warmup() + 1)->seconds();
        ($user ? $this->actingAs($user) : $this)->postJson($this->radio('/escucha'), ['oyente' => self::LISTENER])->assertOk();
    }

    private function radio(string $path, ?Station $station = null): string
    {
        return $this->publicUrl('/radio/'.($station ?? $this->station)->frequency->slug.$path);
    }

    private function song(string $title): Track
    {
        $key = 'music/'.$this->station->id.'/'.Str::uuid().'.mp3';
        Storage::disk((string) config('filesystems.media.public'))->put($key, 'ID3 audio');

        return app(CurrentStation::class)->within($this->station, function () use ($key, $title) {
            $track = Track::query()->create(['kind' => TrackKind::Song, 'title' => $title, 'artist' => 'Rubén Blades', 'file_path' => $key, 'duration' => 240]);
            app(PlayoutCaches::class)->flush();

            return $track;
        });
    }

    #[Test]
    public function a_listener_reads_the_program_of_a_station_off_the_air(): void
    {
        $this->actingAs($this->listener)->getJson($this->radio('/estado'))
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('station.id', $this->station->id)
            ->assertJsonPath('station.frequency', $this->station->frequency->label)
            ->assertJsonPath('on_air', false)
            ->assertJsonPath('queue', [])
            ->assertJsonPath('live.on', false)
            ->assertJsonStructure(['now', 'mix', 'ice', 'layers', 'fallback', 'next_show', 'listeners']);
    }

    #[Test]
    public function a_station_on_the_air_sends_the_songs_every_player_plays_in_step(): void
    {
        $this->song('Pedro Navaja');
        $this->song('Plástico');
        $owner = User::query()->find($this->station->owner_id);
        $this->actingAs($owner)->postJson($this->studioUrl($this->station, '/consola/musica'))->assertOk();
        $this->travel(5)->seconds();

        $state = $this->actingAs($this->listener)->getJson($this->radio('/estado'))->assertOk()->json();

        $this->assertTrue($state['on_air']);
        $this->assertSame('song', $state['queue'][0]['kind']);
        $this->assertStringContainsString('music/'.$this->station->id, $state['queue'][0]['src']);
        $this->assertLessThanOrEqual($state['now'], $state['queue'][0]['start']);
    }

    #[Test]
    public function unknown_and_suspended_stations_are_not_found(): void
    {
        $suspended = Station::factory()->suspended()->create();

        $this->getJson($this->publicUrl('/radio/00-00/estado'))->assertNotFound();
        $this->actingAs($this->listener)->getJson($this->publicUrl('/radio/00-00/estado'))->assertNotFound();
        $this->actingAs($this->listener)->getJson($this->radio('/estado', $suspended))->assertNotFound();
    }

    #[Test]
    public function guests_listen_and_count_in_the_audience_without_an_account(): void
    {
        $this->getJson($this->radio('/estado'))->assertOk()->assertJsonStructure(['on_air', 'queue', 'now']);

        $this->postJson($this->radio('/escucha'), ['oyente' => self::LISTENER])
            ->assertOk()
            ->assertJsonPath('listeners', 0);
        $this->travel(Audience::warmup() + 1)->seconds();
        $this->postJson($this->radio('/escucha'), ['oyente' => self::LISTENER])
            ->assertOk()
            ->assertJsonPath('listeners', 1);

        $this->assertDatabaseHas(ListenerSession::class, ['station_id' => $this->station->id, 'user_id' => null, 'token' => self::LISTENER, 'ended_at' => null, 'suspect' => false]);

        $this->postJson($this->radio('/salir'), ['oyente' => self::LISTENER])->assertOk();
        $this->assertSame(0, $this->station->refresh()->listener_count);
    }

    #[Test]
    public function the_heartbeat_of_a_player_counts_it_in_the_audience_until_it_leaves(): void
    {
        Event::fake([ListenerCountChanged::class]);

        $this->actingAs($this->listener)->postJson($this->radio('/escucha'), ['oyente' => self::LISTENER])->assertOk();
        $this->keepListening($this->listener);

        $this->assertDatabaseHas(ListenerSession::class, ['station_id' => $this->station->id, 'user_id' => $this->listener->id, 'token' => self::LISTENER, 'ended_at' => null]);
        $this->assertSame(1, $this->station->refresh()->listener_count);
        Event::assertDispatched(ListenerCountChanged::class, fn (ListenerCountChanged $event) => $event->listeners === 1);

        $this->actingAs($this->listener)->postJson($this->radio('/salir'), ['oyente' => self::LISTENER])->assertOk();

        $this->assertNotNull(ListenerSession::query()->value('ended_at'));
        $this->assertSame(0, $this->station->refresh()->listener_count);
    }

    #[Test]
    public function the_listener_id_must_be_valid(): void
    {
        $this->actingAs($this->listener)->postJson($this->radio('/escucha'), ['oyente' => 'nope'])
            ->assertJsonValidationErrors('oyente');
        $this->actingAs($this->listener)->postJson($this->radio('/voz'), ['oyente' => self::LISTENER, 'session' => 'abc'])
            ->assertStatus(409);
    }

    #[Test]
    public function players_that_stopped_beating_leave_the_audience(): void
    {
        $this->actingAs($this->listener)->postJson($this->radio('/escucha'), ['oyente' => self::LISTENER])->assertOk();

        $this->travel(Audience::window() + 5)->seconds();
        $this->artisan('streaming:sweep')->assertSuccessful();

        $this->assertNotNull(ListenerSession::query()->value('ended_at'));
        $this->assertSame(0, $this->station->refresh()->listener_count);
    }

    #[Test]
    public function a_failed_audio_makes_the_station_check_its_file(): void
    {
        Bus::fake([VerifyTrackFile::class]);
        $track = $this->song('Pedro Navaja');
        $foreign = Station::factory()->create();

        $this->actingAs($this->listener)->postJson($this->radio('/fallo'), ['oyente' => self::LISTENER, 'track' => $track->id])
            ->assertStatus(202);
        $this->actingAs($this->listener)->postJson($this->radio('/fallo', $foreign), ['oyente' => self::LISTENER, 'track' => $track->id])
            ->assertNotFound();

        Bus::assertDispatched(VerifyTrackFile::class, fn (VerifyTrackFile $job) => $job->trackId === $track->id);
    }

    #[Test]
    public function the_station_team_sees_its_audience_in_the_state(): void
    {
        $this->actingAs($this->listener)->postJson($this->radio('/escucha'), ['oyente' => self::LISTENER])->assertOk();
        $this->keepListening($this->listener);

        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->getJson($this->studioUrl($this->station, '/consola/senal'))
            ->assertOk()
            ->assertJsonPath('snapshot.radio.listeners', 1);
    }
}
