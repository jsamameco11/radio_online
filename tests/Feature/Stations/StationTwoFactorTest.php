<?php

namespace Tests\Feature\Stations;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\StationPreferences;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StationTwoFactorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    /**
     * @return array<string, array{string}>
     */
    public static function studioSections(): array
    {
        return [
            'dashboard' => [''],
            'console' => ['/consola'],
            'library' => ['/biblioteca'],
            'gifts' => ['/regalos'],
        ];
    }

    #[Test]
    #[DataProvider('studioSections')]
    public function a_station_that_requires_two_factor_keeps_out_members_without_it(string $section): void
    {
        $station = Station::factory()->create();
        $member = $this->teamMember($station, StationRole::Owner);
        app(StationPreferences::class)->put($station, 'security', ['require_two_factor' => true]);

        $this->actingAs($member)
            ->get($this->studioUrl($station, $section))
            ->assertRedirect('/cuenta/seguridad');

        $secured = User::factory()->withTwoFactor()->create();
        $station->members()->create(['user_id' => $secured->id, 'role' => StationRole::Owner]);

        $this->actingAs($secured)
            ->get($this->studioUrl($station, $section))
            ->assertOk();
    }
}
