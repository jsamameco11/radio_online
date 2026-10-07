<?php

namespace Tests\Feature\Stations;

use App\Domain\Stations\Support\StationSettings;
use App\Models\Station;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StationSettingsTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function groups_are_merged_over_defaults_and_isolated_per_station(): void
    {
        [$aurora, $urbana] = Station::factory()->count(2)->create();
        $settings = app(StationSettings::class);
        $defaults = ['crossfade' => 4, 'normalize' => true];

        $settings->put($aurora, 'audio', ['crossfade' => 8]);
        $settings->put($urbana, 'audio', ['normalize' => false]);
        $settings->put($aurora, 'audio', ['normalize' => false]);

        $this->assertSame(['crossfade' => 8, 'normalize' => false], $settings->get($aurora, 'audio', $defaults));
        $this->assertSame(['crossfade' => 4, 'normalize' => false], $settings->get($urbana, 'audio', $defaults));
        $this->assertSame($defaults, $settings->get($aurora, 'automation', $defaults));
    }
}
