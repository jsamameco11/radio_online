<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Studio\Enums\TrackKind;
use App\Models\Episode;
use App\Models\ScheduleSlot;
use App\Models\Station;
use App\Models\Track;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** The library upload pipeline: batch duplicate review, replacing an audio, episodes, duck/active and schedule sync. */
class LibraryPipelineTest extends TestCase
{
    use LibraryFixtures, RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeMedia();
        $this->station = Station::factory()->create();
    }

    #[Test]
    public function the_batch_review_judges_only_the_songs_asked_with_their_reasons(): void
    {
        $track = $this->storedTrack($this->station, ['album' => 'Siembra', 'identity' => ['ids' => ['isrc' => 'USFA17800001']]]);

        $response = $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, '/biblioteca/duplicados'), [
                'songs' => [
                    ['key' => 'first', 'title' => 'Otra canción', 'artist' => 'Alguien', 'duration' => 200],
                    ['key' => 'code', 'title' => 'Navaja', 'artist' => 'Otro', 'duration' => 300, 'ids' => ['isrc' => 'usfa17800001']],
                    ['key' => 'swapped', 'title' => 'Rubén Blades', 'artist' => 'Pedro Navaja', 'duration' => 441],
                    ['key' => 'twice', 'title' => 'Otra canción', 'artist' => 'Alguien', 'duration' => 200.5],
                ],
                'judge' => ['code', 'swapped', 'twice'],
            ])
            ->assertOk()
            ->assertJsonMissingPath('results.first')
            ->assertJsonPath('results.code.0.verdict', 'same')
            ->assertJsonPath('results.code.0.track.id', $track->id)
            ->assertJsonPath('results.code.0.reasons.0', 'mismo código ISRC')
            ->assertJsonPath('results.swapped.0.verdict', 'same')
            ->assertJsonPath('results.swapped.0.reasons.0', 'nombre y autor al revés')
            ->assertJsonPath('results.twice.0.batch', 'first')
            ->assertJsonPath('results.twice.0.verdict', 'same');

        $this->assertNotNull($response->json('results.code.0.track.audio_url'));
    }

    #[Test]
    public function the_batch_review_accepts_long_uploads_but_not_beyond_its_limit(): void
    {
        $songs = fn (int $count) => array_map(fn (int $index) => ['key' => "k{$index}", 'title' => "Canción {$index}"], range(1, $count));

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, '/biblioteca/duplicados'), ['songs' => $songs(600), 'judge' => ['k600']])
            ->assertOk()
            ->assertJsonPath('results.k600', []);

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, '/biblioteca/duplicados'), ['songs' => $songs(601)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('songs');
    }

    #[Test]
    public function replacing_an_audio_keeps_the_song_details_and_resets_its_edit(): void
    {
        $track = $this->storedTrack($this->station, [
            'album' => 'Siembra',
            'rotation' => true,
            'original_path' => 'music/x/original.mp3',
            'edit' => ['cuts' => []],
            'edit_status' => 'failed',
        ]);
        $old = $track->file_path;
        $upcoming = $this->slot($track, now()->addDay());

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, "/biblioteca/{$track->id}"), [
                'replace_audio' => '1',
                'kind' => 'song',
                'title' => 'Pedro Navaja (Remastered)',
                'artist' => 'Otro autor',
                'album' => 'Otro álbum',
                'year' => 1978,
                'duration' => 438,
                'audio' => UploadedFile::fake()->create('mejor.mp3', 80, 'audio/mpeg'),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('track.title', 'Pedro Navaja')
            ->assertJsonPath('track.album', 'Siembra')
            ->assertJsonPath('track.year', 1978)
            ->assertJsonPath('track.edited', false)
            ->assertJsonPath('track.rotation', true)
            ->assertJsonPath('track.duration', 438);

        $fresh = $track->fresh();
        $this->assertSame('Rubén Blades', $fresh->artist);
        $this->assertNull($fresh->edit_status);
        $this->assertNotSame($old, $fresh->file_path);
        Storage::disk(config('filesystems.media.public'))->assertMissing($old);
        $this->assertSame(438.0, $upcoming->fresh()->duration);
    }

    #[Test]
    public function replacing_needs_the_new_file(): void
    {
        $track = $this->storedTrack($this->station);

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, "/biblioteca/{$track->id}"), ['replace_audio' => true, 'title' => 'Pedro Navaja', 'duration' => 300])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('audio');
    }

    #[Test]
    public function duck_and_active_are_saved_and_an_inactive_song_leaves_the_automatic_music(): void
    {
        $track = $this->storedTrack($this->station, ['rotation' => true]);

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, "/biblioteca/{$track->id}"), [
                'kind' => 'song',
                'title' => 'Pedro Navaja',
                'artist' => 'Rubén Blades',
                'duck' => true,
                'active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('track.duck', true)
            ->assertJsonPath('track.active', false)
            ->assertJsonPath('track.rotation', false);
    }

    #[Test]
    public function an_inactive_song_cannot_go_into_the_automatic_music(): void
    {
        $track = $this->storedTrack($this->station, ['active' => false]);

        $this->actingAs($this->station->owner)
            ->patch($this->studioUrl($this->station, "/biblioteca/{$track->id}/rotacion"))
            ->assertStatus(422);

        $this->assertFalse($track->fresh()->rotation);
    }

    #[Test]
    public function saving_an_audio_renames_its_upcoming_blocks_only(): void
    {
        $track = $this->storedTrack($this->station);
        $past = $this->slot($track, now()->subDay());
        $upcoming = $this->slot($track, now()->addHour());

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, "/biblioteca/{$track->id}"), ['kind' => 'program', 'title' => 'Especial de salsa', 'artist' => 'DJ Noche'])
            ->assertOk()
            ->assertJsonPath('track.upcoming', 1);

        $this->assertSame(['Especial de salsa', 'program'], [$upcoming->fresh()->title, $upcoming->fresh()->kind]);
        $this->assertSame(['Pedro Navaja', 'song'], [$past->fresh()->title, $past->fresh()->kind]);
    }

    #[Test]
    public function a_new_audio_is_also_published_as_an_episode(): void
    {
        $response = $this->actingAs($this->station->owner)->post($this->studioUrl($this->station, '/biblioteca'), [
            'kind' => 'program',
            'title' => 'Noche de boleros',
            'artist' => 'Radio Aurora',
            'duration' => 1800,
            'audio' => UploadedFile::fake()->create('boleros.mp3', 200, 'audio/mpeg'),
            'episode' => '1',
            'episode_description' => 'Los boleros de siempre.',
            'episode_cover' => UploadedFile::fake()->image('portada.jpg', 600, 600),
        ], ['Accept' => 'application/json']);

        $response->assertCreated()->assertJsonPath('track.episodes_count', 1)->assertJsonPath('track.duck', true);

        $episode = Episode::acrossStations()->where('track_id', $response->json('track.id'))->firstOrFail();
        $this->assertSame(EpisodeStatus::Published, $episode->status);
        $this->assertSame('Radio Aurora', $episode->program);
        $this->assertSame('Los boleros de siempre.', $episode->description);
        $this->assertNotNull($episode->cover_path);
    }

    #[Test]
    public function only_new_audios_can_be_published_as_episodes(): void
    {
        $track = $this->storedTrack($this->station);

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, "/biblioteca/{$track->id}"), ['kind' => 'song', 'title' => 'Pedro Navaja', 'artist' => 'Rubén Blades', 'episode' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('episode');
    }

    #[Test]
    public function a_song_needs_its_author(): void
    {
        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/biblioteca'), [
                'kind' => 'song',
                'title' => 'Sin autor',
                'duration' => 200,
                'audio' => UploadedFile::fake()->create('cancion.mp3', 50, 'audio/mpeg'),
            ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('artist');
    }

    #[Test]
    public function the_library_shows_its_figures_and_loads_the_songs_for_the_shelves_on_demand(): void
    {
        $song = $this->storedTrack($this->station, ['rotation' => true, 'featured' => ['Willie Colón']]);
        $this->storedTrack($this->station, ['kind' => TrackKind::Commercial, 'title' => 'Cuña']);
        $this->storedTrack($this->station, ['kind' => TrackKind::Program, 'title' => 'Programa']);
        $this->slot($song, now()->addDay());

        $this->actingAs($this->station->owner)
            ->get($this->studioUrl($this->station, '/biblioteca'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Library')
                ->where('stats.total', 3)
                ->where('stats.songs', 1)
                ->where('stats.rotation', 1)
                ->where('stats.spots', 1)
                ->where('stats.programs', 1)
                ->where('stats.authors', 2)
                ->missing('songs')
                ->reloadOnly('songs', fn (Assert $reload) => $reload
                    ->has('songs', 1)
                    ->where('songs.0.upcoming', 1)
                    ->where('songs.0.active', true)));

        $this->actingAs($this->station->owner)
            ->get($this->studioUrl($this->station, '/biblioteca?tipo=commercial&buscar=cu'))
            ->assertInertia(fn (Assert $page) => $page->has('tracks.data', 1)->where('tracks.data.0.title', 'Cuña'));
    }

    private function slot(Track $track, mixed $startsAt): ScheduleSlot
    {
        return app(CurrentStation::class)->within($this->station, fn () => ScheduleSlot::query()->create([
            'starts_at' => $startsAt,
            'duration' => $track->duration,
            'kind' => $track->kind->value,
            'layer' => ScheduleSlot::MAIN,
            'track_id' => $track->id,
            'title' => $track->title,
        ]));
    }
}
