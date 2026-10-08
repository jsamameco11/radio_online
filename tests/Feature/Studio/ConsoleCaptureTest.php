<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Studio\Enums\RecordingStatus;
use App\Models\Episode;
use App\Models\Recording;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ConsoleCaptureTest extends TestCase
{
    use LibraryFixtures, RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeMedia();
        $this->station = Station::factory()->create();
    }

    private function recording(User $user): Recording
    {
        $key = 'recordings/'.$this->station->id.'/2026/10/'.Str::uuid().'.webm';
        Storage::disk(config('filesystems.media.private'))->put($key, 'webm audio');

        return app(CurrentStation::class)->within($this->station, fn () => Recording::query()->create([
            'user_id' => $user->id,
            'session' => Str::random(20),
            'status' => RecordingStatus::Ready->value,
            'path' => $key,
            'bytes' => 10,
            'parts' => 1,
            'duration' => 1800,
            'started_at' => now()->subHour(),
            'finished_at' => now()->subMinutes(30),
        ]));
    }

    private function save(Recording $recording): string
    {
        return $this->studioUrl($this->station, "/consola/grabacion/{$recording->id}/guardar");
    }

    #[Test]
    public function the_transmission_is_published_as_an_episode_with_its_cover(): void
    {
        $owner = $this->station->owner;
        $recording = $this->recording($owner);

        $this->actingAs($owner)->post($this->save($recording), [
            'title' => 'Mañanas al aire',
            'kind' => 'program',
            'episode' => '1',
            'publish' => '1',
            'program' => 'Mañanas',
            'description' => 'El programa de hoy.',
            'cover' => UploadedFile::fake()->image('portada.jpg', 600, 600),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('message', 'Guardamos «Mañanas al aire» en la biblioteca y publicamos su episodio: los oyentes ya pueden escucharlo.');

        $episode = Episode::acrossStations()->sole();
        $this->assertSame(EpisodeStatus::Published, $episode->status);
        $this->assertNotNull($episode->published_at);
        $this->assertStringStartsWith("covers/{$this->station->id}/", $episode->cover_path);
        Storage::disk(config('filesystems.media.public'))->assertExists($episode->cover_path);
    }

    #[Test]
    public function without_publishing_the_episode_stays_a_draft(): void
    {
        $owner = $this->station->owner;
        $recording = $this->recording($owner);

        $this->actingAs($owner)->postJson($this->save($recording), ['title' => 'Tarde', 'kind' => 'program', 'episode' => true])
            ->assertOk()
            ->assertJsonPath('message', 'Guardamos «Tarde» en la biblioteca y creamos su episodio como borrador.');

        $episode = Episode::acrossStations()->sole();
        $this->assertSame(EpisodeStatus::Draft, $episode->status);
        $this->assertNull($episode->cover_path);
    }

    #[Test]
    public function publishing_needs_the_episodes_permission_and_a_valid_cover(): void
    {
        $host = $this->teamMember($this->station, StationRole::Host);
        $recording = $this->recording($host);

        $this->actingAs($host)->postJson($this->save($recording), ['title' => 'Tarde', 'kind' => 'program', 'episode' => true, 'publish' => true])
            ->assertForbidden();
        $this->actingAs($host)->post($this->save($recording), ['title' => 'Tarde', 'kind' => 'program', 'cover' => UploadedFile::fake()->create('portada.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertJsonValidationErrors('cover');
        $this->actingAs($host)->postJson($this->save($recording), ['title' => 'Tarde', 'kind' => 'program', 'description' => str_repeat('a', 2001)])
            ->assertJsonValidationErrors('description');

        $this->assertSame(0, Episode::acrossStations()->count());
    }
}
