<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Broadcast\BroadcastConfig;
use App\Models\AuditLog;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ConsoleSettingsTest extends TestCase
{
    use LibraryFixtures, RefreshDatabase;

    private Station $station;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeMedia();
        $this->station = Station::factory()->create();
        $this->manager = $this->teamMember($this->station, StationRole::Manager);
    }

    private function settings(string $path): string
    {
        return $this->studioUrl($this->station, '/configuracion'.$path);
    }

    /** @return array<string, mixed> */
    private function group(string $group): array
    {
        return app(CurrentStation::class)->within($this->station, fn () => app(BroadcastConfig::class)->group($group));
    }

    /** @return array<string, mixed> */
    private function broadcastForm(array $overrides = []): array
    {
        return [
            'on_air' => false,
            'show_titles' => false,
            'live_mode' => 'manual',
            'live_source' => 'console',
            'live_url' => '',
            'max_voice' => 120,
            'stream_url' => '',
            'bitrate_kbps' => 96,
            ...$overrides,
        ];
    }

    #[Test]
    public function a_manager_opens_the_three_settings_pages(): void
    {
        $this->actingAs($this->manager)->get($this->settings('/transmision'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Settings/Broadcast')
                ->where('settings.on_air', false)
                ->where('settings.max_voice', 60)
                ->has('liveModes', 2)
                ->has('liveSources', 2)
                ->has('bitrates'));

        $this->actingAs($this->manager)->get($this->settings('/audio'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Settings/Audio')
                ->where('settings.crossfade', 4)
                ->missing('settings.pads')
                ->has('maxFade'));

        $this->actingAs($this->manager)->get($this->settings('/automatizacion'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Settings/Automation')
                ->where('settings.autofill', true)
                ->where('settings.playlist', null)
                ->has('autopilot')
                ->has('playlists', 0));
    }

    #[Test]
    public function broadcast_settings_are_saved_and_audited(): void
    {
        $this->actingAs($this->manager)->from($this->settings('/transmision'))
            ->put($this->settings('/transmision'), $this->broadcastForm(['stream_url' => 'https://stream.example.com/live']))
            ->assertRedirect($this->settings('/transmision'))
            ->assertSessionHas('success');

        $saved = $this->group('broadcast');
        $this->assertFalse($saved['show_titles']);
        $this->assertSame('manual', $saved['live_mode']);
        $this->assertSame(120, $saved['max_voice']);
        $this->assertSame('https://stream.example.com/live', $this->station->fresh()->external_stream_url);
        $this->assertSame(96, (int) $this->station->fresh()->bitrate_kbps);
        $this->assertTrue(AuditLog::query()->where('action', 'station.settings_updated')->exists());
    }

    #[Test]
    public function an_external_live_source_needs_its_link(): void
    {
        $this->actingAs($this->manager)->from($this->settings('/transmision'))
            ->put($this->settings('/transmision'), $this->broadcastForm(['live_source' => 'external']))
            ->assertSessionHasErrors('live_url');

        $this->actingAs($this->manager)->from($this->settings('/transmision'))
            ->put($this->settings('/transmision'), $this->broadcastForm(['bitrate_kbps' => 100]))
            ->assertSessionHasErrors('bitrate_kbps');

        $this->assertSame('console', $this->group('broadcast')['live_source']);
    }

    #[Test]
    public function audio_settings_are_saved_within_their_limits(): void
    {
        $this->actingAs($this->manager)->from($this->settings('/audio'))
            ->put($this->settings('/audio'), ['crossfade' => 6.5, 'bed_level' => 30, 'fx_level' => 80, 'duck_level' => 15])
            ->assertRedirect($this->settings('/audio'));

        $saved = $this->group('audio');
        $this->assertEquals(6.5, $saved['crossfade']);
        $this->assertSame(30, $saved['bed_level']);
        $this->assertSame(15, $saved['duck_level']);

        $this->actingAs($this->manager)->from($this->settings('/audio'))
            ->put($this->settings('/audio'), ['crossfade' => 30, 'bed_level' => 30, 'fx_level' => 80, 'duck_level' => 15])
            ->assertSessionHasErrors('crossfade');
    }

    #[Test]
    public function automation_settings_turn_the_automatic_music_off_and_stop_repeating(): void
    {
        $this->actingAs($this->manager)->from($this->settings('/automatizacion'))
            ->put($this->settings('/automatizacion'), ['autofill' => false, 'playlist' => null, 'shuffle' => true, 'repeat' => false])
            ->assertRedirect($this->settings('/automatizacion'))
            ->assertSessionHas('success');

        $saved = $this->group('automation');
        $this->assertFalse($saved['autofill']);
        $this->assertFalse($saved['auto_repeat']);
    }

    #[Test]
    public function settings_are_closed_to_other_stations_and_to_members_without_the_permission(): void
    {
        $outsider = $this->teamMember(Station::factory()->create(), StationRole::Owner);
        $host = $this->teamMember($this->station, StationRole::Host);

        foreach (['/transmision', '/audio', '/automatizacion'] as $path) {
            $this->actingAs($outsider)->get($this->settings($path))->assertForbidden();
            $this->actingAs($host)->get($this->settings($path))->assertForbidden();
        }

        $this->actingAs($host)->put($this->settings('/transmision'), $this->broadcastForm(['on_air' => true]))->assertForbidden();
        $this->actingAs($outsider)->put($this->settings('/audio'), ['crossfade' => 2, 'bed_level' => 30, 'fx_level' => 80, 'duck_level' => 15])->assertForbidden();
        $this->assertFalse($this->group('broadcast')['on_air']);
        $this->assertSame(4, $this->group('audio')['crossfade']);
    }
}
