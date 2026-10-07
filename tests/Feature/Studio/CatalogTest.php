<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Models\Artist;
use App\Models\Genre;
use App\Models\Station;
use Database\Seeders\CatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CatalogTest extends TestCase
{
    use LibraryFixtures, RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeMedia();
        $this->seed(CatalogSeeder::class);
        $this->station = Station::factory()->create();
    }

    #[Test]
    public function the_seeder_loads_a_broad_catalog_once(): void
    {
        $genres = Genre::query()->count();
        $artists = Artist::query()->count();

        $this->seed(CatalogSeeder::class);

        $this->assertGreaterThan(100, $genres);
        $this->assertGreaterThan(100, $artists);
        $this->assertSame($genres, Genre::query()->count());
        $this->assertSame($artists, Artist::query()->count());
        $this->assertTrue(Genre::query()->where('family', 'christian')->exists());
    }

    #[Test]
    public function the_catalog_page_counts_only_this_stations_songs(): void
    {
        $salsa = Genre::query()->where('slug', 'salsa')->firstOrFail();
        $this->storedTrack($this->station)->genres()->attach($salsa->id, ['position' => 0]);
        $this->storedTrack(Station::factory()->create())->genres()->attach($salsa->id, ['position' => 0]);

        $this->actingAs($this->station->owner)
            ->get($this->studioUrl($this->station, '/catalogo?buscar=Blades'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Catalog')
                ->has('songs', 1)
                ->where('artists.data.0.name', 'Rubén Blades')
                ->where('genres', fn ($genres) => collect($genres)->firstWhere('id', $salsa->id)['songs'] === 1));
    }

    #[Test]
    public function genres_are_added_or_replaced_on_songs_of_the_station(): void
    {
        [$salsa, $bolero, $son] = collect(['salsa', 'bolero', 'son-cubano'])
            ->map(fn (string $slug) => Genre::query()->where('slug', $slug)->firstOrFail());
        $song = $this->storedTrack($this->station);
        $foreign = $this->storedTrack(Station::factory()->create());

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/catalogo/asignar'), ['track_ids' => [$song->id, $foreign->id], 'genre_ids' => [$salsa->id], 'mode' => 'add'])
            ->assertRedirect();
        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/catalogo/asignar'), ['track_ids' => [$song->id], 'genre_ids' => [$bolero->id], 'mode' => 'add'])
            ->assertRedirect();
        $this->assertSame(['salsa', 'bolero'], $song->genres()->pluck('slug')->all());
        $this->assertSame(0, $foreign->genres()->count());

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/catalogo/asignar'), ['track_ids' => [$song->id], 'genre_ids' => [$son->id], 'mode' => 'replace'])
            ->assertRedirect();
        $this->assertSame(['son-cubano'], $song->genres()->pluck('slug')->all());
    }

    #[Test]
    public function songs_without_genres_take_the_genres_of_their_artist(): void
    {
        $song = $this->storedTrack($this->station);

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/catalogo/clasificar'))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertContains('salsa', $song->genres()->pluck('slug')->all());
    }

    #[Test]
    public function new_artists_are_added_once_and_need_the_library_permission(): void
    {
        $rock = Genre::query()->where('slug', 'rock')->firstOrFail();
        $payload = ['name' => 'Los Pericos Nuevos', 'kind' => 'group', 'country' => 'ar', 'genre_ids' => [$rock->id]];

        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->post($this->studioUrl($this->station, '/catalogo/artistas'), $payload)
            ->assertForbidden();

        $this->actingAs($this->station->owner)->post($this->studioUrl($this->station, '/catalogo/artistas'), $payload)->assertSessionHasNoErrors();
        $artist = Artist::query()->where('name', 'Los Pericos Nuevos')->sole();
        $this->assertSame('manual', $artist->source);
        $this->assertSame('AR', $artist->country);
        $this->assertSame(['rock'], $artist->genres()->pluck('slug')->all());

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/catalogo/artistas'), $payload)
            ->assertSessionHasErrors(['name' => 'Este artista ya está en el catálogo.']);
    }
}
