<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Studio\Enums\TrackKind;
use App\Jobs\PublishScheduledEpisodes;
use App\Models\Episode;
use App\Models\Hashtag;
use App\Models\Station;
use App\Models\Track;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class EpisodesTest extends TestCase
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
    public function an_episode_recorded_in_the_browser_is_uploaded_and_published(): void
    {
        $response = $this->actingAs($this->teamMember($this->station, StationRole::Editor))
            ->post($this->studioUrl($this->station, '/episodios'), [
                'title' => 'Entrevista con la banda',
                'program' => 'Noches de rock',
                'description' => 'Una charla en cabina.',
                'season' => 2,
                'number' => 7,
                'hashtags' => ['#Rock Nacional', 'entrevistas'],
                'status' => 'published',
                'source' => 'upload',
                'duration' => 1520.4,
                'audio' => UploadedFile::fake()->create('grabacion.webm', 200, 'audio/webm'),
                'cover' => UploadedFile::fake()->image('portada.png', 800, 800),
            ], ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('episode.title', 'Entrevista con la banda')
            ->assertJsonPath('episode.hashtags', ['RockNacional', 'Entrevistas'])
            ->assertJsonPath('episode.status.value', 'published')
            ->assertJsonPath('episode.duration', 1520.4)
            ->assertJsonPath('episode.season', 2);

        $episode = Episode::acrossStations()->with('track')->sole();
        $this->assertSame($this->station->id, $episode->station_id);
        $this->assertNotNull($episode->published_at);
        $this->assertSame(TrackKind::Program, $episode->track->kind);
        $this->assertStringStartsWith("programs/{$this->station->id}/", $episode->track->file_path);
        Storage::disk(config('filesystems.media.public'))->assertExists([$episode->track->file_path, $episode->cover_path]);
        $this->assertSame(1, Hashtag::query()->where('slug', 'rocknacional')->value('uses_count'));
    }

    #[Test]
    public function an_episode_uses_an_audio_of_the_library_and_can_be_scheduled(): void
    {
        $audio = $this->storedTrack($this->station, ['kind' => TrackKind::Program, 'title' => 'Programa 12']);

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/episodios'), [
                'title' => 'Programa 12',
                'status' => 'scheduled',
                'publish_at' => now()->addDay()->toIso8601String(),
                'source' => 'library',
                'track_id' => $audio->id,
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('episode.status.value', 'scheduled');

        $episode = Episode::acrossStations()->sole();
        $this->assertNull($episode->published_at);

        $this->travel(2)->days();
        (new PublishScheduledEpisodes)->handle();

        $episode->refresh();
        $this->assertSame(EpisodeStatus::Published, $episode->status);
        $this->assertNotNull($episode->published_at);
        $this->assertNull($episode->publish_at);
    }

    #[Test]
    public function scheduling_needs_a_future_date_and_a_library_audio_of_this_station(): void
    {
        $foreign = $this->storedTrack(Station::factory()->create(), ['kind' => TrackKind::Program]);

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/episodios'), [
                'title' => 'Programa',
                'status' => 'scheduled',
                'publish_at' => now()->subDay()->toIso8601String(),
                'source' => 'library',
                'track_id' => $foreign->id,
            ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['publish_at' => 'La fecha de publicación debe ser futura.']);

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/episodios'), [
                'title' => 'Programa',
                'status' => 'draft',
                'source' => 'library',
                'track_id' => $foreign->id,
            ], ['Accept' => 'application/json'])
            ->assertNotFound();
    }

    #[Test]
    public function episodes_are_listed_edited_published_archived_and_deleted(): void
    {
        $audio = $this->storedTrack($this->station, ['kind' => TrackKind::Program]);
        $owner = $this->station->owner;
        $id = $this->actingAs($owner)->post($this->studioUrl($this->station, '/episodios'), [
            'title' => 'Borrador', 'status' => 'draft', 'source' => 'library', 'track_id' => $audio->id, 'hashtags' => ['radio'],
        ], ['Accept' => 'application/json'])->json('episode.id');

        $this->actingAs($owner)
            ->get($this->studioUrl($this->station, '/episodios'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Episodes')
                ->has('episodes.data', 1)
                ->where('episodes.data.0.status.value', 'draft')
                ->has('audios', 1));

        $this->actingAs($owner)
            ->post($this->studioUrl($this->station, "/episodios/{$id}"), ['title' => 'Episodio final', 'status' => 'draft', 'hashtags' => ['radio', 'envivo']], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('episode.title', 'Episodio final')
            ->assertJsonPath('episode.track.id', $audio->id);

        $this->actingAs($owner)->patch($this->studioUrl($this->station, "/episodios/{$id}/estado"), ['status' => 'published'])->assertRedirect();
        $this->assertSame(EpisodeStatus::Published, Episode::acrossStations()->find($id)->status);

        $this->actingAs($owner)->patch($this->studioUrl($this->station, "/episodios/{$id}/estado"), ['status' => 'archived'])->assertRedirect();
        $this->assertSame(EpisodeStatus::Archived, Episode::acrossStations()->find($id)->status);

        $this->actingAs($owner)->delete($this->studioUrl($this->station, "/episodios/{$id}"))->assertRedirect();
        $this->assertDatabaseMissing('episodes', ['id' => $id]);
        $this->assertTrue(Track::acrossStations()->whereKey($audio->id)->exists());
        $this->assertSame(0, Hashtag::query()->where('slug', 'radio')->value('uses_count'));
    }

    #[Test]
    public function hosts_and_other_stations_cannot_manage_episodes(): void
    {
        $other = Station::factory()->create();
        $audio = $this->storedTrack($other, ['kind' => TrackKind::Program]);
        $id = $this->actingAs($other->owner)->post($this->studioUrl($other, '/episodios'), [
            'title' => 'Ajeno', 'status' => 'draft', 'source' => 'library', 'track_id' => $audio->id,
        ], ['Accept' => 'application/json'])->json('episode.id');

        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->get($this->studioUrl($this->station, '/episodios'))
            ->assertForbidden();
        $this->actingAs($this->station->owner)
            ->patch($this->studioUrl($this->station, "/episodios/{$id}/estado"), ['status' => 'published'])
            ->assertNotFound();
        $this->actingAs($this->station->owner)
            ->get($this->studioUrl($other, '/episodios'))
            ->assertForbidden();
    }
}
