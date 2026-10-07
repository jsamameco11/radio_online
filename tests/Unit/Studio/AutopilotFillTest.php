<?php

namespace Tests\Unit\Studio;

use App\Domain\Studio\Broadcast\Autopilot;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class AutopilotFillTest extends TestCase
{
    /** @return list<array<string, mixed>> songs of 3 minutes that overlap 4 seconds */
    private function songs(int $count): array
    {
        return array_map(fn (int $i) => [
            'id' => sprintf('%08d-0000-4000-8000-000000000000', $i),
            'kind' => 'song',
            'title' => "Canción {$i}",
            'artist' => 'Artista',
            'src' => "music/{$i}.mp3",
            'cover' => null,
            'ms' => 180000,
            'step' => 176000,
        ], range(1, $count));
    }

    #[Test]
    public function songs_follow_each_other_overlapping_by_the_crossfade(): void
    {
        $items = Autopilot::fill($this->songs(3), false, 0, 0, 600000, 10);

        $this->assertSame([0, 176000, 352000, 528000], array_column($items, 'origin'));
        $this->assertSame(['Canción 1', 'Canción 2', 'Canción 3', 'Canción 1'], array_column($items, 'title'));
        $this->assertSame(180000, $items[0]['end']);
        $this->assertSame(600000, $items[3]['end'], 'The last song is cut at the end of the stretch');
    }

    #[Test]
    public function a_listener_joining_mid_song_seeks_to_the_same_moment_as_everyone(): void
    {
        $items = Autopilot::fill($this->songs(3), false, 0, 200000, 400000, 10);

        $this->assertSame(176000, $items[0]['origin']);
        $this->assertSame(200000, $items[0]['start']);
        $this->assertEquals(24.0, $items[0]['seek']);
    }

    #[Test]
    public function every_listener_computes_the_same_shuffled_program(): void
    {
        $songs = $this->songs(8);

        $this->assertSame(
            Autopilot::fill($songs, true, 1000, 5000000, 9000000, 50),
            Autopilot::fill($songs, true, 1000, 5000000, 9000000, 50),
        );
    }

    #[Test]
    public function a_shuffled_cycle_never_opens_with_the_song_that_closed_the_previous_one(): void
    {
        $songs = $this->songs(4);
        $items = Autopilot::fill($songs, true, 0, 0, 40 * 4 * 176000, 400);

        foreach (array_chunk($items, 4) as $index => $cycle) {
            if ($index > 0 && count($cycle) === 4) {
                $this->assertNotSame($previous[3]['track'], $cycle[0]['track']);
                $this->assertCount(4, array_unique(array_column($cycle, 'track')), 'Each cycle plays every song once');
            }
            $previous = $cycle;
        }
    }

    #[Test]
    public function a_list_in_order_starts_from_the_chosen_song(): void
    {
        $songs = $this->songs(3);
        $items = Autopilot::fill($songs, false, 0, 0, 400000, 3, first: $songs[1]['id']);

        $this->assertSame(['Canción 2', 'Canción 3', 'Canción 1'], array_column($items, 'title'));
    }

    #[Test]
    public function a_ragged_stretch_lets_its_last_song_play_to_the_end(): void
    {
        $items = Autopilot::fill($this->songs(2), false, 0, 0, 200000, 10, ['block' => 'b1'], ragged: true);

        $this->assertSame(356000, end($items)['end']);
        $this->assertSame(['b1', 'b1'], array_column($items, 'block'));
    }

    #[Test]
    public function nothing_fills_without_songs_or_time(): void
    {
        $this->assertSame([], Autopilot::fill([], true, 0, 0, 600000, 10));
        $this->assertSame([], Autopilot::fill($this->songs(2), true, 0, 600000, 600000, 10));
    }
}
