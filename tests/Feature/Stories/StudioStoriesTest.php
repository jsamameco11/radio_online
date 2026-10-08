<?php

namespace Tests\Feature\Stories;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stories\Enums\StoryKind;
use App\Models\AuditLog;
use App\Models\Station;
use App\Models\StationStory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StudioStoriesTest extends TestCase
{
    use RefreshDatabase, StoryFixtures;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeMedia();
        $this->station = Station::factory()->create();
    }

    /** @param  array<string, mixed>  $data */
    private function postStory(array $data, ?Station $station = null): TestResponse
    {
        $station ??= $this->station;

        return $this->actingAs($station->owner)->post($this->studioUrl($station, '/estados'), $data, ['Accept' => 'application/json']);
    }

    #[Test]
    public function the_team_posts_a_photo_that_expires_in_a_day(): void
    {
        $this->freezeSecond();

        $this->postStory([
            'kind' => 'image',
            'text' => '  Esta noche, especial de salsa  ',
            'media' => UploadedFile::fake()->image('foto.jpg', 1080, 1920),
        ])
            ->assertCreated()
            ->assertJsonPath('story.kind', 'image')
            ->assertJsonPath('story.text', 'Esta noche, especial de salsa')
            ->assertJsonPath('story.duration_ms', 6000)
            ->assertJsonPath('story.views_count', 0)
            ->assertJsonPath('story.posted_by', $this->station->owner->name);

        $story = StationStory::acrossStations()->sole();
        $this->assertSame($this->station->id, $story->station_id);
        $this->assertStringStartsWith("stories/{$this->station->id}/", $story->media_key);
        $this->assertTrue($story->expires_at->equalTo(now()->addDay()));
        Storage::disk(config('filesystems.media.public'))->assertExists($story->media_key);
        $this->assertTrue(AuditLog::query()->where('action', 'stories.posted')->where('subject_id', $story->id)->exists());
    }

    #[Test]
    public function a_manager_posts_a_text_story_that_lasts_by_its_length(): void
    {
        $manager = $this->teamMember($this->station, StationRole::Manager);

        $this->actingAs($manager)->post($this->studioUrl($this->station, '/estados'), [
            'kind' => 'text', 'text' => 'Hola', 'background' => 'aurora',
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('story.background', 'aurora')
            ->assertJsonPath('story.duration_ms', 6000)
            ->assertJsonPath('story.media_url', null);

        $this->actingAs($manager)->post($this->studioUrl($this->station, '/estados'), [
            'kind' => 'text', 'text' => str_repeat('a', 250), 'background' => 'night',
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('story.duration_ms', 10000);

        $this->postStory(['kind' => 'text', 'background' => 'night'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['text' => 'Escribe el texto del estado.']);
        $this->postStory(['kind' => 'text', 'text' => str_repeat('a', 251), 'background' => 'sepia'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['text', 'background']);
        $this->postStory(['kind' => 'text', 'text' => 'Hola', 'background' => 'night', 'media' => UploadedFile::fake()->image('x.jpg')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['media' => 'Un estado de texto no lleva archivo.']);
    }

    #[Test]
    public function photos_and_videos_are_checked_for_type_and_size(): void
    {
        $this->postStory(['kind' => 'image', 'media' => UploadedFile::fake()->create('doc.pdf', 20, 'application/pdf')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('media');
        $this->postStory(['kind' => 'image', 'media' => UploadedFile::fake()->image('enorme.jpg')->size(11 * 1024)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['media' => 'La foto puede pesar como máximo 10 MB.']);
        $this->postStory(['kind' => 'video', 'duration' => 10, 'media' => UploadedFile::fake()->create('clip.avi', 100, 'video/x-msvideo')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['media' => 'El video debe ser MP4, WEBM o MOV.']);
        $this->postStory(['kind' => 'video', 'duration' => 10, 'media' => UploadedFile::fake()->create('clip.mp4', 61 * 1024, 'video/mp4')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['media' => 'El video puede pesar como máximo 60 MB.']);
        $this->postStory(['kind' => 'video', 'media' => UploadedFile::fake()->create('clip.mp4', 100, 'video/mp4')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('duration');

        $this->assertSame(0, StationStory::acrossStations()->count());
    }

    #[Test]
    public function without_ffprobe_the_video_length_the_browser_read_is_capped(): void
    {
        $this->postStory([
            'kind' => 'video',
            'duration' => 75.4,
            'media' => UploadedFile::fake()->create('clip.mp4', 900, 'video/mp4'),
            'poster' => UploadedFile::fake()->image('poster.jpg', 540, 960),
        ])
            ->assertCreated()
            ->assertJsonPath('story.kind', 'video')
            ->assertJsonPath('story.duration_ms', 60000);

        $story = StationStory::acrossStations()->sole();
        Storage::disk(config('filesystems.media.public'))->assertExists([$story->media_key, $story->poster_key]);
    }

    #[Test]
    public function with_ffprobe_the_real_video_length_is_used_and_long_videos_are_rejected(): void
    {
        $this->probeMeasures(12.34);
        $this->postStory(['kind' => 'video', 'duration' => 3, 'media' => UploadedFile::fake()->create('clip.webm', 900, 'video/webm')])
            ->assertCreated()
            ->assertJsonPath('story.duration_ms', 12340)
            ->assertJsonPath('story.poster_url', null);

        $this->probeMeasures(90);
        $this->postStory(['kind' => 'video', 'duration' => 30, 'media' => UploadedFile::fake()->create('clip.mov', 900, 'video/quicktime')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['media' => 'El video puede durar como máximo 60 segundos.']);

        $this->probeMeasures(null, available: true);
        $this->postStory(['kind' => 'video', 'duration' => 30, 'media' => UploadedFile::fake()->create('roto.mp4', 900, 'video/mp4')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('media');

        $this->assertSame(1, StationStory::acrossStations()->count());
        $this->assertCount(1, Storage::disk(config('filesystems.media.public'))->allFiles('stories'));
    }

    #[Test]
    public function a_station_can_only_have_so_many_active_stories(): void
    {
        config(['platform.stories.max_active' => 2]);
        $this->storedStory($this->station);
        $this->storedStory($this->station, ['expires_at' => now()->subMinute()]);
        $this->storedStory(Station::factory()->create());

        $this->postStory(['kind' => 'text', 'text' => 'Segundo', 'background' => 'signal'])->assertCreated();
        $this->postStory(['kind' => 'image', 'media' => UploadedFile::fake()->image('tercero.jpg')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('kind');

        $this->assertSame(3, StationStory::acrossStations()->where('station_id', $this->station->id)->count());
    }

    #[Test]
    public function the_page_lists_the_active_stories_with_their_views(): void
    {
        $this->storedStory($this->station, ['views_count' => 124]);
        $this->storedStory($this->station, ['expires_at' => now()->subHour()]);
        $this->storedStory(Station::factory()->create());

        $this->actingAs($this->station->owner)
            ->get($this->studioUrl($this->station, '/estados'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Stories')
                ->has('stories', 1)
                ->where('stories.0.views_count', 124)
                ->where('limits.max_active', 30)
                ->where('limits.max_video_seconds', 60)
                ->has('limits.backgrounds', 6));
    }

    #[Test]
    public function the_team_deletes_its_own_stories_with_their_files(): void
    {
        $story = $this->storedStory($this->station, ['kind' => StoryKind::Video, 'poster_key' => 'stories/'.$this->station->id.'/2026/10/poster.jpg']);
        Storage::disk(config('filesystems.media.public'))->put($story->poster_key, 'poster');
        $foreign = $this->storedStory(Station::factory()->create());

        $this->actingAs($this->station->owner)
            ->delete($this->studioUrl($this->station, "/estados/{$foreign->id}"))
            ->assertNotFound();
        $this->actingAs($this->station->owner)
            ->delete($this->studioUrl($this->station, "/estados/{$story->id}"))
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('station_stories', ['id' => $story->id]);
        $this->assertDatabaseHas('station_stories', ['id' => $foreign->id]);
        Storage::disk(config('filesystems.media.public'))->assertMissing([$story->media_key, $story->poster_key]);
        Storage::disk(config('filesystems.media.public'))->assertExists($foreign->media_key);
        $this->assertTrue(AuditLog::query()->where('action', 'stories.deleted')->exists());
    }

    #[Test]
    public function members_without_the_profile_permission_cannot_manage_stories(): void
    {
        $story = $this->storedStory($this->station);

        foreach ([StationRole::Host, StationRole::Editor] as $role) {
            $member = $this->teamMember($this->station, $role);
            $this->actingAs($member)->get($this->studioUrl($this->station, '/estados'))->assertForbidden();
            $this->actingAs($member)
                ->post($this->studioUrl($this->station, '/estados'), ['kind' => 'text', 'text' => 'Hola', 'background' => 'signal'], ['Accept' => 'application/json'])
                ->assertForbidden();
            $this->actingAs($member)->delete($this->studioUrl($this->station, "/estados/{$story->id}"))->assertForbidden();
        }

        $this->actingAs(Station::factory()->create()->owner)
            ->get($this->studioUrl($this->station, '/estados'))
            ->assertForbidden();
        $this->assertDatabaseHas('station_stories', ['id' => $story->id]);
    }
}
