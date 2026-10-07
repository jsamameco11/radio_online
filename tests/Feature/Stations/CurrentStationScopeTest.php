<?php

namespace Tests\Feature\Stations;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Enums\TrackKind;
use App\Models\Station;
use App\Models\Track;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CurrentStationScopeTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function station_data_is_isolated_by_the_current_station(): void
    {
        [$aurora, $urbana] = Station::factory()->count(2)->create();
        $current = app(CurrentStation::class);

        $current->within($aurora, fn () => Track::query()->create(['kind' => TrackKind::Song, 'title' => 'Aurora song', 'file_path' => 'music/1/a.mp3', 'duration' => 180]));
        $current->within($urbana, fn () => Track::query()->create(['kind' => TrackKind::Song, 'title' => 'Urbana song', 'file_path' => 'music/2/b.mp3', 'duration' => 200]));

        $this->assertSame(['Aurora song'], $current->within($aurora, fn () => Track::query()->pluck('title')->all()));
        $this->assertSame(['Urbana song'], $current->within($urbana, fn () => Track::query()->pluck('title')->all()));
        $this->assertSame(2, Track::query()->count());
        $this->assertFalse($current->has());
    }
}
