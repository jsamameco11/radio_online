<?php

namespace Tests\Feature\Stations;

use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Stations\Actions\OpenStation;
use App\Domain\Stations\Enums\StationRole;
use App\Models\Category;
use App\Models\Frequency;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OpenStationTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_opens_a_station_on_a_free_frequency(): void
    {
        $this->seed(CategorySeeder::class);
        $owner = User::factory()->create();
        $frequency = Frequency::factory()->create(['label' => '89.30', 'frequency' => '89.30', 'slug' => '89-30']);
        $categories = Category::query()->limit(5)->pluck('id')->all();

        $station = app(OpenStation::class)->handle($owner, $frequency, 'Radio Aurora', $categories, ['#Salsa', 'Perú', 'salsa']);

        $this->assertSame('89.30 · Radio Aurora', $station->displayName());
        $this->assertSame(FrequencyStatus::Active, $frequency->fresh()->status);
        $this->assertSame(StationRole::Owner, $owner->roleIn($station));
        $this->assertCount(3, $station->categories);
        $this->assertSame(['Salsa', 'Peru'], $station->hashtags->pluck('name')->all());
    }

    #[Test]
    public function a_frequency_in_use_cannot_host_a_second_station(): void
    {
        $owner = User::factory()->create();
        $frequency = Frequency::factory()->create();
        app(OpenStation::class)->handle($owner, $frequency, 'Radio Uno');

        $this->expectException(InvalidArgumentException::class);

        app(OpenStation::class)->handle($owner, $frequency->fresh(), 'Radio Dos');
    }
}
