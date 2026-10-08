<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Enums\TrackKind;
use App\Models\AuditLog;
use App\Models\Playlist;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ConsoleRotationTest extends TestCase
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

    private function drop(string $id): string
    {
        return $this->studioUrl($this->station, '/consola/musica/no-repetir/'.$id);
    }

    #[Test]
    public function a_song_leaves_the_automatic_music_and_its_playlists(): void
    {
        $song = $this->storedTrack($this->station, ['title' => 'Plástico', 'rotation' => true]);
        $other = $this->storedTrack($this->station, ['title' => 'Pedro Navaja', 'rotation' => true]);
        $list = app(CurrentStation::class)->within($this->station, function () use ($song, $other) {
            $list = Playlist::query()->create(['name' => 'Salsa']);
            $list->tracks()->attach([$song->id => ['position' => 0], $other->id => ['position' => 1]]);

            return $list;
        });

        $this->actingAs($this->host)->deleteJson($this->drop($song->id))
            ->assertOk()
            ->assertJsonPath('message', '«Plástico» salió de la música automática (y de su lista) y no se repetirá.')
            ->assertJsonStructure(['snapshot' => ['autopilot']]);

        $this->assertFalse($song->fresh()->rotation);
        $this->assertSame([$other->id], $list->tracks()->pluck('tracks.id')->all());
        $this->assertDatabaseHas(AuditLog::class, ['action' => 'broadcast.rotation_dropped', 'station_id' => $this->station->id]);
    }

    #[Test]
    public function only_songs_of_the_station_can_be_dropped(): void
    {
        $foreign = $this->storedTrack(Station::factory()->create(), ['rotation' => true]);
        $effect = $this->storedTrack($this->station, ['kind' => TrackKind::Effect, 'duration' => 3]);

        $this->actingAs($this->host)->deleteJson($this->drop($foreign->id))->assertNotFound();
        $this->actingAs($this->host)->deleteJson($this->drop($effect->id))->assertNotFound();
        $this->actingAs($this->teamMember($this->station, StationRole::Editor))->deleteJson($this->drop($effect->id))->assertForbidden();
        $this->assertTrue($foreign->fresh()->rotation);
    }
}
