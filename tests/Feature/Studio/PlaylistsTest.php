<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Studio\Enums\TrackKind;
use App\Models\Playlist;
use App\Models\Station;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PlaylistsTest extends TestCase
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
    public function a_playlist_keeps_its_songs_in_order_and_ignores_other_audios(): void
    {
        $first = $this->storedTrack($this->station, ['title' => 'Primera']);
        $second = $this->storedTrack($this->station, ['title' => 'Segunda']);
        $jingle = $this->storedTrack($this->station, ['kind' => TrackKind::Jingle, 'title' => 'Cortina']);
        $foreign = $this->storedTrack(Station::factory()->create(), ['title' => 'Ajena']);

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/listas'), [
                'name' => 'Salsa clásica',
                'track_ids' => [$second->id, $first->id, $jingle->id, $foreign->id],
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $playlist = Playlist::acrossStations()->with('tracks')->sole();
        $this->assertSame($this->station->id, $playlist->station_id);
        $this->assertSame(['Segunda', 'Primera'], $playlist->tracks->pluck('title')->all());

        $this->actingAs($this->station->owner)
            ->get($this->studioUrl($this->station, '/listas'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Playlists')
                ->has('playlists', 1)
                ->has('playlists.0.tracks', 2)
                ->has('songs', 2));
    }

    #[Test]
    public function playlists_are_renamed_reordered_shuffled_and_deleted(): void
    {
        $songs = collect(range(1, 6))->map(fn (int $n) => $this->storedTrack($this->station, ['title' => "Canción {$n}"]));
        $owner = $this->station->owner;
        $this->actingAs($owner)->post($this->studioUrl($this->station, '/listas'), ['name' => 'Mañanas', 'track_ids' => $songs->pluck('id')->all()]);
        $this->actingAs($owner)->post($this->studioUrl($this->station, '/listas'), ['name' => 'Noches']);
        [$mornings, $nights] = [Playlist::acrossStations()->where('name', 'Mañanas')->sole(), Playlist::acrossStations()->where('name', 'Noches')->sole()];

        $this->actingAs($owner)->put($this->studioUrl($this->station, "/listas/{$mornings->id}"), ['name' => 'Mañanas tropicales', 'track_ids' => $songs->pluck('id')->all()])->assertRedirect();
        $this->assertSame('Mañanas tropicales', $mornings->fresh()->name);

        $this->actingAs($owner)->post($this->studioUrl($this->station, '/listas/orden'), ['ids' => [$nights->id, $mornings->id]])->assertRedirect();
        $this->assertSame(1, $nights->fresh()->sort_order);
        $this->assertSame(2, $mornings->fresh()->sort_order);

        $this->actingAs($owner)->post($this->studioUrl($this->station, "/listas/{$mornings->id}/mezclar"))->assertRedirect();
        $this->assertCount(6, $mornings->tracks()->get());

        $this->actingAs($owner)->delete($this->studioUrl($this->station, "/listas/{$nights->id}"))->assertRedirect();
        $this->assertDatabaseMissing('playlists', ['id' => $nights->id]);
    }

    #[Test]
    public function playlists_are_private_to_their_station_and_need_the_library_permission(): void
    {
        $other = Station::factory()->create();
        $this->actingAs($other->owner)->post($this->studioUrl($other, '/listas'), ['name' => 'Ajena']);
        $foreign = Playlist::acrossStations()->sole();

        $this->actingAs($this->station->owner)
            ->put($this->studioUrl($this->station, "/listas/{$foreign->id}"), ['name' => 'Robada'])
            ->assertNotFound();
        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->get($this->studioUrl($this->station, '/listas'))
            ->assertForbidden();
        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/listas'), ['name' => ''])
            ->assertSessionHasErrors(['name' => 'Escribe el nombre de la lista.']);
    }
}
