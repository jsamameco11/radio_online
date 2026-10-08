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

    #[Test]
    public function a_station_adds_a_style_whose_names_belong_to_no_other(): void
    {
        $url = $this->studioUrl($this->station, '/catalogo/estilos');

        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->post($url, ['name' => 'Cumbia lunar', 'family' => 'tropical'])
            ->assertForbidden();

        $this->actingAs($this->station->owner)
            ->post($url, ['name' => 'salsa', 'family' => 'tropical'])
            ->assertSessionHasErrors(['name' => 'Ya existe el estilo «Salsa».']);
        $this->actingAs($this->station->owner)
            ->post($url, ['name' => 'Perreo viejo', 'family' => 'urban', 'aliases' => 'Old school, Reggaeton'])
            ->assertSessionHasErrors('aliases');

        $this->actingAs($this->station->owner)
            ->post($url, ['name' => 'cumbia lunar', 'family' => 'tropical', 'aliases' => 'Cumbia psicodélica lunar, Cumbia lunar'])
            ->assertSessionHasNoErrors();

        $lunar = Genre::query()->where('name', 'Cumbia lunar')->sole();
        $this->assertTrue($lunar->custom);
        $this->assertSame($this->station->id, $lunar->station_id);
        $this->assertSame(['Cumbia psicodélica lunar'], $lunar->aliases);

        $this->actingAs($this->station->owner)
            ->get($this->studioUrl($this->station, '/catalogo'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('genres', fn ($genres) => collect($genres)->firstWhere('id', $lunar->id)['editable'] === true)
                ->where('genres', fn ($genres) => collect($genres)->firstWhere('name', 'Salsa')['editable'] === false)
                ->where('stats.own_genres', 1));
    }

    #[Test]
    public function only_the_station_that_added_a_style_changes_it(): void
    {
        $lunar = $this->addGenre('Cumbia lunar');
        $salsa = Genre::query()->where('slug', 'salsa')->firstOrFail();
        $other = Station::factory()->create();
        $payload = ['name' => 'Cumbia lunar nueva', 'family' => 'tropical', 'aliases' => ['Cumbia lunar']];

        $this->actingAs($other->owner)->put($this->studioUrl($other, "/catalogo/estilos/{$lunar->id}"), $payload)->assertForbidden();
        $this->actingAs($other->owner)->delete($this->studioUrl($other, "/catalogo/estilos/{$lunar->id}"))->assertForbidden();
        $this->actingAs($this->station->owner)->put($this->studioUrl($this->station, "/catalogo/estilos/{$salsa->id}"), $payload)->assertForbidden();
        $this->actingAs($this->station->owner)->delete($this->studioUrl($this->station, "/catalogo/estilos/{$salsa->id}"))->assertForbidden();

        $this->actingAs($this->station->owner)
            ->put($this->studioUrl($this->station, "/catalogo/estilos/{$lunar->id}"), $payload)
            ->assertSessionHasNoErrors();
        $this->assertSame('Cumbia lunar nueva', $lunar->fresh()->name);
        $this->assertSame(['Cumbia lunar'], $lunar->fresh()->aliases);
    }

    #[Test]
    public function deleting_a_style_takes_it_off_the_songs_and_is_audited(): void
    {
        $lunar = $this->addGenre('Cumbia lunar');
        $song = $this->storedTrack($this->station);
        $song->genres()->attach($lunar->id, ['position' => 0]);

        $this->actingAs($this->station->owner)
            ->delete($this->studioUrl($this->station, "/catalogo/estilos/{$lunar->id}"))
            ->assertSessionHas('success', 'Eliminamos el estilo Cumbia lunar y lo quitamos de 1 canción.');

        $this->assertModelMissing($lunar);
        $this->assertSame(0, $song->genres()->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'catalog.genre_deleted', 'station_id' => $this->station->id]);
    }

    #[Test]
    public function a_style_other_stations_use_stays_in_the_catalog(): void
    {
        $lunar = $this->addGenre('Cumbia lunar');
        $this->storedTrack(Station::factory()->create())->genres()->attach($lunar->id, ['position' => 0]);

        $this->actingAs($this->station->owner)
            ->delete($this->studioUrl($this->station, "/catalogo/estilos/{$lunar->id}"))
            ->assertSessionHasErrors('genre');

        $this->assertModelExists($lunar);
    }

    #[Test]
    public function a_station_edits_and_removes_only_the_artists_it_added(): void
    {
        $rock = Genre::query()->where('slug', 'rock')->firstOrFail();
        $pop = Genre::query()->where('slug', 'pop')->firstOrFail();
        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/catalogo/artistas'), ['name' => 'Los Pericos Nuevos', 'genre_ids' => [$rock->id]])
            ->assertSessionHasNoErrors();
        $artist = Artist::query()->where('name', 'Los Pericos Nuevos')->sole();
        $starter = Artist::query()->where('name', 'Rubén Blades')->firstOrFail();
        $other = Station::factory()->create();

        $this->actingAs($other->owner)->put($this->studioUrl($other, "/catalogo/artistas/{$artist->id}"), ['name' => 'Otro'])->assertForbidden();
        $this->actingAs($this->station->owner)->put($this->studioUrl($this->station, "/catalogo/artistas/{$starter->id}"), ['name' => 'Otro'])->assertForbidden();
        $this->actingAs($this->station->owner)->delete($this->studioUrl($this->station, "/catalogo/artistas/{$starter->id}"))->assertForbidden();

        $this->actingAs($this->station->owner)
            ->put($this->studioUrl($this->station, "/catalogo/artistas/{$artist->id}"), ['name' => 'Los Pericos Nuevos', 'aliases' => 'Rubén Blades'])
            ->assertSessionHasErrors(['aliases' => 'Rubén Blades ya está en el catálogo como otro artista.']);

        $this->actingAs($this->station->owner)
            ->put($this->studioUrl($this->station, "/catalogo/artistas/{$artist->id}"), [
                'name' => 'Los Pericos Nuevos', 'kind' => 'group', 'country' => 'AR', 'aliases' => 'Pericos Nuevos; LPN', 'genre_ids' => [$pop->id, $rock->id],
            ])
            ->assertSessionHasNoErrors();
        $artist->refresh();
        $this->assertSame(['Pericos Nuevos', 'LPN'], $artist->aliases);
        $this->assertSame(['pop', 'rock'], $artist->genres()->pluck('slug')->all());

        $this->actingAs($this->station->owner)
            ->get($this->studioUrl($this->station, '/catalogo?origen=station&tipo=group&buscar=lpn'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('artists.data', 1)
                ->where('artists.data.0.editable', true)
                ->where('artists.data.0.genres.0.id', $pop->id));

        $this->actingAs($this->station->owner)
            ->delete($this->studioUrl($this->station, "/catalogo/artistas/{$artist->id}"))
            ->assertSessionHas('success');
        $this->assertModelMissing($artist);
        $this->assertDatabaseHas('audit_logs', ['action' => 'catalog.artist_deleted', 'station_id' => $this->station->id]);
    }

    private function addGenre(string $name): Genre
    {
        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/catalogo/estilos'), ['name' => $name, 'family' => 'tropical'])
            ->assertSessionHasNoErrors();

        return Genre::query()->where('name', $name)->sole();
    }
}
