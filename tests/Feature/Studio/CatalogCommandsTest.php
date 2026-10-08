<?php

namespace Tests\Feature\Studio;

use App\Models\Genre;
use App\Models\Station;
use Database\Seeders\CatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CatalogCommandsTest extends TestCase
{
    use LibraryFixtures, RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeMedia();
        $this->seed(CatalogSeeder::class);
        $this->station = Station::factory()->create();
        Http::fake([
            'itunes.apple.com/*' => Http::response(['results' => [[
                'kind' => 'song', 'trackId' => 1, 'collectionId' => 2, 'trackName' => 'Pedro Navaja', 'artistName' => 'Rubén Blades & Willie Colón',
                'collectionName' => 'Siembra', 'trackCount' => 7, 'releaseDate' => '1978-01-01T08:00:00Z', 'trackTimeMillis' => 441000,
                'primaryGenreName' => 'Salsa y Tropical',
            ]]]),
            'api.deezer.com/search*' => Http::response(['data' => [[
                'id' => 10, 'type' => 'track', 'title' => 'Pedro Navaja', 'duration' => 441,
                'artist' => ['id' => 5, 'name' => 'Rubén Blades'], 'album' => ['id' => 7, 'title' => 'Siembra'],
            ]]]),
            'api.deezer.com/album/*' => Http::response(['record_type' => 'album', 'release_date' => '1978-06-01', 'genres' => ['data' => [['name' => 'Salsa']]]]),
            'api.deezer.com/track/*' => Http::response(['contributors' => [['name' => 'Rubén Blades', 'role' => 'Main'], ['name' => 'Willie Colón', 'role' => 'Main']], 'isrc' => 'USFA17800001']),
            'musicbrainz.org/*' => Http::response(['recordings' => []]),
            'www.wikidata.org/*' => Http::response(['search' => []]),
        ]);
    }

    #[Test]
    public function identify_completes_the_songs_of_a_station(): void
    {
        $song = $this->storedTrack($this->station);
        $foreign = $this->storedTrack(Station::factory()->create());

        $this->artisan('radio:identify', ['--station' => $this->station->frequency->slug])->assertSuccessful();

        $song->refresh();
        $this->assertNotNull($song->identified_at);
        $this->assertSame('Siembra', $song->album);
        $this->assertSame(1978, (int) $song->year);
        $this->assertSame(['Willie Colón'], $song->featured);
        $this->assertSame('USFA17800001', $song->identity['ids']['isrc']);
        $this->assertSame('salsa', $song->genres()->first()?->slug);
        $this->assertNull($foreign->fresh()->identified_at);
    }

    #[Test]
    public function a_dry_run_saves_nothing_and_unknown_stations_fail(): void
    {
        $song = $this->storedTrack($this->station);

        $this->artisan('radio:identify', ['--station' => (string) $this->station->id, '--dry' => true])
            ->expectsOutputToContain('Siembra')
            ->assertSuccessful();
        $this->assertNull($song->fresh()->identified_at);
        $this->assertSame(0, $song->genres()->count());

        $this->artisan('radio:identify', ['--station' => '0-00'])->assertFailed();
    }

    #[Test]
    public function the_catalog_command_adds_only_what_is_missing(): void
    {
        Genre::query()->where('slug', 'salsa')->delete();

        $this->artisan('radio:catalog')->assertSuccessful();

        $this->assertTrue(Genre::query()->where('slug', 'salsa')->exists());
    }
}
