<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Studio\Editor\AudioEditor;
use App\Domain\Studio\Editor\EditRecipe;
use App\Domain\Studio\Editor\EditStatus;
use App\Domain\Studio\Editor\FilterGraph;
use App\Models\Station;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class EditorTest extends TestCase
{
    use LibraryFixtures, RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeMedia();
        Cache::forget('editor:ffmpeg-available');
        $this->station = Station::factory()->create();
    }

    /** ffmpeg answers, and every render writes its output file. */
    private function fakeFfmpeg(): void
    {
        Process::fake(function (PendingProcess $process) {
            $command = (array) $process->command;
            $target = end($command);
            if (is_string($target) && str_ends_with($target, '.mp3')) {
                file_put_contents($target, 'edited mp3');
            }

            return Process::result();
        });
    }

    private function recipe(array $changes = []): array
    {
        return [...EditRecipe::defaults(), ...$changes];
    }

    #[Test]
    public function the_editor_opens_an_audio_of_the_station(): void
    {
        $this->fakeFfmpeg();
        $track = $this->storedTrack($this->station);

        $this->actingAs($this->station->owner)
            ->get($this->studioUrl($this->station, "/editor?audio={$track->id}"))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Editor')
                ->where('available', true)
                ->where('track.id', $track->id)
                ->where('track.edited', false)
                ->has('tracks', 1));
    }

    #[Test]
    public function an_edit_is_rendered_in_the_background_and_can_be_undone(): void
    {
        $this->fakeFfmpeg();
        $track = $this->storedTrack($this->station);
        $original = $track->file_path;

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, "/editor/{$track->id}"), ['recipe' => $this->recipe(['cuts' => [[0, 41]], 'fadeOut' => 3, 'gain' => 2])])
            ->assertStatus(202);

        $track->refresh();
        $this->assertNull($track->edit_status);
        $this->assertSame($original, $track->original_path);
        $this->assertNotSame($original, $track->file_path);
        $this->assertSame(400.0, $track->duration);
        $this->assertSame([[0, 41]], $track->edit['cuts']);
        Storage::disk(config('filesystems.media.public'))->assertExists([$original, $track->file_path]);

        $this->actingAs($this->station->owner)
            ->getJson($this->studioUrl($this->station, "/editor/{$track->id}/estado"))
            ->assertOk()
            ->assertJsonPath('track.edited', true)
            ->assertJsonPath('track.duration', 400);

        $edited = $track->file_path;
        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, "/editor/{$track->id}/restaurar"))
            ->assertOk()
            ->assertJsonPath('track.edited', false);

        $track->refresh();
        $this->assertSame($original, $track->file_path);
        $this->assertSame(441.0, $track->duration);
        Storage::disk(config('filesystems.media.public'))->assertMissing($edited);
    }

    #[Test]
    public function a_failed_render_leaves_the_audio_as_it_was_with_a_message(): void
    {
        Process::fake(fn (PendingProcess $process) => in_array('-version', (array) $process->command, true)
            ? Process::result()
            : Process::result(errorOutput: 'Invalid data found', exitCode: 1));
        $track = $this->storedTrack($this->station);

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, "/editor/{$track->id}"), ['recipe' => $this->recipe(['gain' => 3])])
            ->assertStatus(202);

        $track->refresh();
        $this->assertSame(EditStatus::Failed->value, $track->edit_status);
        $this->assertNotNull($track->edit_error);
        $this->assertNull($track->original_path);
    }

    #[Test]
    public function without_ffmpeg_the_editor_says_it_is_unavailable(): void
    {
        Process::fake(fn () => Process::result(exitCode: 127));
        $track = $this->storedTrack($this->station);

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, "/editor/{$track->id}"), ['recipe' => $this->recipe(['gain' => 3])])
            ->assertStatus(503)
            ->assertJsonPath('message', AudioEditor::UNAVAILABLE);
        $this->assertNull($track->fresh()->edit_status);
    }

    #[Test]
    public function an_edit_that_leaves_no_audio_is_rejected(): void
    {
        $this->fakeFfmpeg();
        $track = $this->storedTrack($this->station);

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, "/editor/{$track->id}"), ['recipe' => $this->recipe(['cuts' => [[0, 441]]])])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('recipe');
    }

    #[Test]
    public function the_editor_is_kept_to_the_station_and_its_permissions(): void
    {
        $foreign = $this->storedTrack(Station::factory()->create());
        $song = $this->storedTrack($this->station);

        $this->actingAs($this->station->owner)
            ->postJson($this->studioUrl($this->station, "/editor/{$foreign->id}"), ['recipe' => $this->recipe()])
            ->assertNotFound();
        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->get($this->studioUrl($this->station, '/editor'))
            ->assertForbidden();
        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->getJson($this->studioUrl($this->station, "/editor/{$song->id}/estado"))
            ->assertForbidden();
    }

    #[Test]
    public function the_filter_graph_follows_the_recipe(): void
    {
        $recipe = EditRecipe::from(['cuts' => [[10, 20], [30, 40]], 'join' => 0.5, 'fadeIn' => 2, 'eq' => [3, 0, 0, 0, -2], 'compress' => 50, 'lowcut' => true], 100);

        $graph = FilterGraph::build($recipe, 100);

        $this->assertSame(79.0, EditRecipe::length($recipe, 100));
        $this->assertStringContainsString('acrossfade=d=0.5', $graph);
        $this->assertStringContainsString('highpass=f=80', $graph);
        $this->assertStringContainsString('bass=g=3', $graph);
        $this->assertStringContainsString('treble=g=-2', $graph);
        $this->assertStringContainsString('acompressor=', $graph);
        $this->assertStringContainsString('afade=t=in:st=0:d=2', $graph);
        $this->assertNull(EditRecipe::from(['cuts' => [[0, 100]]], 100));
    }
}
