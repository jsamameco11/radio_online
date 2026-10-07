<?php

namespace Tests\Unit\Studio;

use App\Domain\Studio\Broadcast\LiveDesk;
use App\Domain\Studio\Broadcast\LiveSwitch;
use App\Domain\Studio\Broadcast\ProgramEngine;
use App\Domain\Studio\Broadcast\StationBroadcast;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class ProgramStateTest extends TestCase
{
    /** @return array<string, mixed> */
    private function state(array $overrides = []): array
    {
        return [
            'station' => ['id' => 1, 'name' => 'Radio Aurora', 'frequency' => '89.30'],
            'show_titles' => true,
            'on_air' => true,
            'queue' => [[
                'kind' => 'song', 'title' => 'Pedro Navaja', 'artist' => 'Rubén Blades', 'cover' => null,
                'start' => 1000, 'end' => 181000, 'origin' => 1000,
            ]],
            'live' => ['on' => false, 'title' => '', 'host' => null, 'started_at' => null],
            ...$overrides,
        ];
    }

    #[Test]
    public function now_playing_is_the_item_of_the_queue_sounding_now(): void
    {
        $playing = StationBroadcast::nowPlaying($this->state(), 60000);

        $this->assertSame('Pedro Navaja', $playing['title']);
        $this->assertSame('Rubén Blades', $playing['artist']);
        $this->assertSame(180, $playing['duration']);
        $this->assertNull(StationBroadcast::nowPlaying($this->state(), 200000));
    }

    #[Test]
    public function song_titles_hide_behind_the_station_name_when_the_station_says_so(): void
    {
        $playing = StationBroadcast::nowPlaying($this->state(['show_titles' => false]), 60000);

        $this->assertSame('Radio Aurora', $playing['title']);
        $this->assertNull($playing['artist']);
    }

    #[Test]
    public function the_live_transmission_wins_over_the_queue_and_off_air_nothing_plays(): void
    {
        $live = StationBroadcast::nowPlaying($this->state(['live' => ['on' => true, 'title' => 'Mañanas', 'host' => 'Ana', 'started_at' => 5000]]), 60000);

        $this->assertSame('live', $live['kind']);
        $this->assertSame('Mañanas', $live['title']);
        $this->assertNull(StationBroadcast::nowPlaying($this->state(['on_air' => false]), 60000));
    }

    #[Test]
    public function a_live_cut_is_open_from_its_start_until_its_end(): void
    {
        $this->assertFalse(LiveSwitch::isOpen(null, 10));
        $this->assertTrue(LiveSwitch::isOpen(['start' => 5, 'end' => null], 10));
        $this->assertFalse(LiveSwitch::isOpen(['start' => 5, 'end' => 10], 10));
        $this->assertFalse(LiveSwitch::isOpen(['start' => 15, 'end' => null], 10));
    }

    #[Test]
    public function only_songs_of_the_gaps_count_as_automatic_music(): void
    {
        $this->assertTrue(ProgramEngine::automatic(['kind' => 'song', 'slot' => null, 'block' => null]));
        $this->assertFalse(ProgramEngine::automatic(['kind' => 'song', 'slot' => 'a-slot', 'block' => null]));
        $this->assertFalse(ProgramEngine::automatic(['kind' => 'jingle', 'slot' => null, 'block' => null]));
    }

    #[Test]
    public function the_crossfade_is_kept_in_milliseconds(): void
    {
        $this->assertSame(4500, ProgramEngine::crossfadeMs(['crossfade' => 4.5]));
    }

    #[Test]
    public function a_new_live_session_starts_with_the_microphone_closed(): void
    {
        $session = LiveDesk::session('Ana', 7, 'Mañanas');

        $this->assertMatchesRegularExpression('/^[a-z0-9]{16,40}$/', $session['session']);
        $this->assertSame('Ana', $session['host']);
        $this->assertSame(7, $session['host_id']);
        $this->assertFalse($session['mic']);
    }
}
