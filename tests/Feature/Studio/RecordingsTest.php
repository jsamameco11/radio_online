<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Studio\Enums\RecordingStatus;
use App\Models\Episode;
use App\Models\Recording;
use App\Models\Station;
use App\Models\Track;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RecordingsTest extends TestCase
{
    use LibraryFixtures, RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeMedia();
        $this->station = Station::factory()->create();
    }

    private function recording(Station $station, RecordingStatus $status = RecordingStatus::Ready): Recording
    {
        $key = 'recordings/'.$station->id.'/2026/10/'.Str::uuid().'.webm';
        Storage::disk(config('filesystems.media.private'))->put($key, 'webm audio');

        return app(CurrentStation::class)->within($station, fn () => Recording::query()->create([
            'user_id' => $station->owner_id,
            'session' => Str::random(20),
            'status' => $status->value,
            'path' => $key,
            'bytes' => 10,
            'parts' => 1,
            'duration' => 1800,
            'started_at' => now()->subHour(),
            'finished_at' => now()->subMinutes(30),
        ]));
    }

    #[Test]
    public function the_team_lists_the_recordings_of_their_station(): void
    {
        $this->recording($this->station);
        $this->recording(Station::factory()->create());

        $this->actingAs($this->teamMember($this->station, StationRole::Editor))
            ->get($this->studioUrl($this->station, '/grabaciones'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Recordings')
                ->has('recordings.data', 1)
                ->where('recordings.data.0.convertible', true)
                ->where('recordings.data.0.status.value', 'ready'));
    }

    #[Test]
    public function a_recording_becomes_a_library_audio_and_a_draft_episode(): void
    {
        $recording = $this->recording($this->station);

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, "/grabaciones/{$recording->id}/convertir"), [
                'title' => 'Mañanas al aire',
                'kind' => 'program',
                'episode' => '1',
                'program' => 'Mañanas',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $track = Track::acrossStations()->sole();
        $this->assertSame($this->station->id, $track->station_id);
        $this->assertStringStartsWith("programs/{$this->station->id}/", $track->file_path);
        Storage::disk(config('filesystems.media.public'))->assertExists($track->file_path);
        $this->assertSame(1800.0, $track->duration);
        $this->assertSame(RecordingStatus::Saved->value, $recording->fresh()->getRawOriginal('status'));
        $this->assertSame($track->id, $recording->fresh()->track_id);

        $episode = Episode::acrossStations()->sole();
        $this->assertSame(EpisodeStatus::Draft, $episode->status);
        $this->assertSame('Mañanas', $episode->program);

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, "/grabaciones/{$recording->id}/convertir"), ['title' => 'Otra vez', 'kind' => 'program'])
            ->assertSessionHasErrors('recording');
    }

    #[Test]
    public function editors_turn_a_recording_into_an_episode(): void
    {
        $recording = $this->recording($this->station);

        $this->actingAs($this->teamMember($this->station, StationRole::Editor))
            ->post($this->studioUrl($this->station, "/grabaciones/{$recording->id}/convertir"), ['title' => 'Programa', 'kind' => 'program', 'episode' => '1'])
            ->assertRedirect();
        $this->assertSame(1, Episode::acrossStations()->count());
    }

    #[Test]
    public function recordings_are_deleted_with_their_file_but_not_while_recording(): void
    {
        $ready = $this->recording($this->station);
        $live = $this->recording($this->station, RecordingStatus::Recording);

        $this->actingAs($this->station->owner)->delete($this->studioUrl($this->station, "/grabaciones/{$ready->id}"))->assertRedirect();
        $this->assertDatabaseMissing('recordings', ['id' => $ready->id]);
        Storage::disk(config('filesystems.media.private'))->assertMissing($ready->path);

        $this->actingAs($this->station->owner)->delete($this->studioUrl($this->station, "/grabaciones/{$live->id}"))->assertSessionHasErrors('recording');
        $this->assertDatabaseHas('recordings', ['id' => $live->id]);
    }

    #[Test]
    public function recordings_of_other_stations_and_members_without_permission_are_kept_out(): void
    {
        $foreign = $this->recording(Station::factory()->create());

        $this->actingAs($this->station->owner)
            ->delete($this->studioUrl($this->station, "/grabaciones/{$foreign->id}"))
            ->assertNotFound();
        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->get($this->studioUrl($this->station, '/grabaciones'))
            ->assertForbidden();
    }
}
