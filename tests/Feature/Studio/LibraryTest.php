<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\FileProblem;
use App\Models\Genre;
use App\Models\Station;
use App\Models\Track;
use Database\Seeders\CatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class LibraryTest extends TestCase
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
    public function editors_see_the_library_of_their_station_only(): void
    {
        $this->storedTrack($this->station);
        $this->storedTrack(Station::factory()->create(), ['title' => 'Ajena']);
        $editor = $this->teamMember($this->station, StationRole::Editor);

        $this->actingAs($editor)
            ->get($this->studioUrl($this->station, '/biblioteca'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Library')
                ->has('tracks.data', 1)
                ->where('tracks.data.0.title', 'Pedro Navaja')
                ->where('kinds.0.count', 1));
    }

    #[Test]
    public function hosts_and_other_stations_cannot_manage_the_library(): void
    {
        $track = $this->storedTrack($this->station);
        $host = $this->teamMember($this->station, StationRole::Host);
        $outsider = $this->teamMember(Station::factory()->create(), StationRole::Owner);

        $this->actingAs($host)->get($this->studioUrl($this->station, '/biblioteca'))->assertForbidden();
        $this->actingAs($host)->deleteJson($this->studioUrl($this->station, "/biblioteca/{$track->id}"))->assertForbidden();
        $this->actingAs($outsider)->get($this->studioUrl($this->station, '/biblioteca'))->assertForbidden();
    }

    #[Test]
    public function an_audio_of_another_station_cannot_be_reached_from_this_studio(): void
    {
        $foreign = $this->storedTrack(Station::factory()->create());

        $this->actingAs($this->station->owner)
            ->deleteJson($this->studioUrl($this->station, "/biblioteca/{$foreign->id}"))
            ->assertNotFound();
        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, "/biblioteca/{$foreign->id}"), ['title' => 'Mía'])
            ->assertNotFound();
        $this->assertDatabaseHas('tracks', ['id' => $foreign->id, 'title' => 'Pedro Navaja']);
    }

    #[Test]
    public function a_song_is_uploaded_with_its_details_cover_and_genres(): void
    {
        $this->seed(CatalogSeeder::class);
        $salsa = Genre::query()->where('slug', 'salsa')->firstOrFail();

        $response = $this->actingAs($this->station->owner)->post($this->studioUrl($this->station, '/biblioteca'), [
            'kind' => 'song',
            'title' => 'Plástico',
            'artist' => 'Rubén Blades',
            'featured' => ['Willie Colón'],
            'album' => 'Siembra',
            'year' => 1978,
            'genre_ids' => [$salsa->id],
            'duration' => 412.5,
            'rotation' => '1',
            'audio' => UploadedFile::fake()->create('plastico.mp3', 300, 'audio/mpeg'),
            'cover' => UploadedFile::fake()->image('siembra.jpg', 600, 600),
            'identity' => json_encode(['confidence' => 'high', 'score' => 0.95, 'sources' => ['itunes'], 'ids' => ['itunes' => '1'], 'artist' => ['country' => 'PA']]),
        ], ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('track.title', 'Plástico')
            ->assertJsonPath('track.credit', 'Rubén Blades, Willie Colón')
            ->assertJsonPath('track.genres.0.name', 'Salsa')
            ->assertJsonPath('track.confidence', 'high')
            ->assertJsonPath('track.rotation', true);

        $track = Track::acrossStations()->findOrFail($response->json('track.id'));
        $this->assertSame($this->station->id, $track->station_id);
        $this->assertStringStartsWith("music/{$this->station->id}/", $track->file_path);
        $this->assertStringStartsWith("covers/{$this->station->id}/", $track->cover_path);
        Storage::disk(config('filesystems.media.public'))->assertExists([$track->file_path, $track->cover_path]);
        $this->assertSame(412.5, $track->duration);
    }

    #[Test]
    public function the_same_song_twice_asks_for_confirmation(): void
    {
        $this->storedTrack($this->station);
        $payload = fn (array $extra = []) => [
            'kind' => 'song',
            'title' => 'Pedro Navaja (Official Video)',
            'artist' => 'Ruben Blades',
            'duration' => 440,
            'audio' => UploadedFile::fake()->create('pedro.mp3', 100, 'audio/mpeg'),
            ...$extra,
        ];

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/biblioteca'), $payload(), ['Accept' => 'application/json'])
            ->assertStatus(409)
            ->assertJsonPath('duplicates.0.verdict', 'same');

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/biblioteca'), $payload(['duplicate_ok' => '1']), ['Accept' => 'application/json'])
            ->assertCreated();

        $this->assertSame(2, Track::acrossStations()->where('station_id', $this->station->id)->count());
    }

    #[Test]
    public function files_that_are_not_audio_are_rejected(): void
    {
        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/biblioteca'), [
                'kind' => 'jingle',
                'title' => 'Identificación',
                'duration' => 5,
                'audio' => UploadedFile::fake()->create('notas.pdf', 10, 'application/pdf'),
            ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('audio');

        $this->assertSame(0, Track::acrossStations()->count());
    }

    #[Test]
    public function the_duplicate_check_compares_a_batch_with_the_library_and_itself(): void
    {
        $this->storedTrack($this->station);

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, '/biblioteca/duplicados'), ['songs' => [
                ['key' => 'a', 'title' => 'Pedro Navaja (En Vivo)', 'artist' => 'Rubén Blades', 'duration' => 500],
                ['key' => 'b', 'title' => 'Decisiones', 'artist' => 'Rubén Blades', 'duration' => 200],
                ['key' => 'c', 'title' => 'Decisiones', 'artist' => 'Rubén Blades', 'duration' => 201],
            ]])
            ->assertOk()
            ->assertJsonPath('results.a.0.verdict', 'version')
            ->assertJsonPath('results.b', [])
            ->assertJsonPath('results.c.0.batch', 'b')
            ->assertJsonPath('results.c.0.verdict', 'same');
    }

    #[Test]
    public function details_are_updated_and_a_new_file_replaces_the_old_one(): void
    {
        $track = $this->storedTrack($this->station);
        $old = $track->file_path;

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, "/biblioteca/{$track->id}"), [
                'title' => 'Pedro Navaja',
                'artist' => 'Rubén Blades',
                'album' => 'Siembra',
                'duration' => 300,
                'audio' => UploadedFile::fake()->create('nuevo.mp3', 50, 'audio/mpeg'),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('track.album', 'Siembra')
            ->assertJsonPath('track.duration', 300);

        Storage::disk(config('filesystems.media.public'))->assertMissing($old);
        $this->assertNotSame($old, $track->fresh()->file_path);
    }

    #[Test]
    public function deleting_an_audio_removes_its_files(): void
    {
        $track = $this->storedTrack($this->station);

        $this->actingAs($this->station->owner)
            ->delete($this->studioUrl($this->station, "/biblioteca/{$track->id}"))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('tracks', ['id' => $track->id]);
        Storage::disk(config('filesystems.media.public'))->assertMissing($track->file_path);
        $this->assertDatabaseHas('audit_logs', ['action' => 'library.delete', 'station_id' => $this->station->id]);
    }

    #[Test]
    public function only_songs_go_in_and_out_of_the_automatic_music(): void
    {
        $song = $this->storedTrack($this->station);
        $jingle = $this->storedTrack($this->station, ['kind' => TrackKind::Jingle, 'title' => 'Cortina']);

        $this->actingAs($this->station->owner)->patch($this->studioUrl($this->station, "/biblioteca/{$song->id}/rotacion"))->assertRedirect();
        $this->assertTrue($song->fresh()->rotation);

        $this->actingAs($this->station->owner)->patch($this->studioUrl($this->station, "/biblioteca/{$jingle->id}/rotacion"))->assertStatus(422);
    }

    #[Test]
    public function the_file_check_marks_missing_files(): void
    {
        $healthy = $this->storedTrack($this->station);
        $lost = $this->storedTrack($this->station, ['title' => 'Perdida']);
        Storage::disk(config('filesystems.media.public'))->delete($lost->file_path);

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/biblioteca/revision'))
            ->assertRedirect();

        $this->assertNull($healthy->fresh()->file_problem);
        $this->assertSame(FileProblem::Missing->value, $lost->fresh()->file_problem);
        $this->assertNotNull($lost->fresh()->file_checked_at);
    }

    #[Test]
    public function a_song_is_identified_on_the_internet_and_mapped_to_catalog_genres(): void
    {
        $this->seed(CatalogSeeder::class);
        Http::fake([
            'itunes.apple.com/*' => Http::response(['results' => [[
                'kind' => 'song', 'trackId' => 1, 'collectionId' => 2, 'trackName' => 'Pedro Navaja', 'artistName' => 'Rubén Blades & Willie Colón',
                'collectionName' => 'Siembra', 'trackCount' => 7, 'releaseDate' => '1978-01-01T08:00:00Z', 'trackTimeMillis' => 441000,
                'primaryGenreName' => 'Salsa y Tropical', 'artworkUrl100' => 'https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg',
            ]]]),
            'api.deezer.com/search*' => Http::response(['data' => [[
                'id' => 10, 'type' => 'track', 'title' => 'Pedro Navaja', 'duration' => 441,
                'artist' => ['id' => 5, 'name' => 'Rubén Blades'], 'album' => ['id' => 7, 'title' => 'Siembra', 'cover_xl' => 'https://e-cdns-images.dzcdn.net/images/cover/x.jpg'],
            ]]]),
            'api.deezer.com/album/*' => Http::response(['record_type' => 'album', 'release_date' => '1978-06-01', 'genres' => ['data' => [['name' => 'Salsa']]]]),
            'api.deezer.com/track/*' => Http::response(['contributors' => [['name' => 'Rubén Blades', 'role' => 'Main'], ['name' => 'Willie Colón', 'role' => 'Main']], 'isrc' => 'USFA17800001']),
            'musicbrainz.org/*' => Http::response(['recordings' => []]),
            'www.wikidata.org/*' => Http::response(['search' => []]),
        ]);

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, '/biblioteca/identificar'), ['title' => 'Pedro Navaja', 'artist' => 'Rubén Blades', 'duration' => 440])
            ->assertOk()
            ->assertJsonPath('found', true)
            ->assertJsonPath('artist', 'Rubén Blades')
            ->assertJsonPath('featured', ['Willie Colón'])
            ->assertJsonPath('album', 'Siembra')
            ->assertJsonPath('year', 1978)
            ->assertJsonPath('genres.0.name', 'Salsa')
            ->assertJsonPath('identity.ids.isrc', 'USFA17800001');
    }

    #[Test]
    public function an_unknown_song_is_reported_as_not_found(): void
    {
        Http::fake(['*' => Http::response([], 500)]);

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, '/biblioteca/identificar'), ['title' => 'Canción inventada', 'artist' => 'Nadie'])
            ->assertOk()
            ->assertJsonPath('found', false)
            ->assertJsonPath('identity', null);
    }
}
