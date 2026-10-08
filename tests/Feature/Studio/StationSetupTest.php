<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Models\Station;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StationSetupTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    #[Test]
    public function every_studio_page_tells_the_owner_what_is_left_to_set_up(): void
    {
        $station = Station::factory()->create(['logo_path' => null, 'cover_path' => null, 'description' => str_repeat('Música y noticias para el barrio. ', 3)]);

        foreach (['', '/perfil', '/estadisticas', '/configuracion'] as $path) {
            $this->actingAs($station->owner)
                ->get($this->studioUrl($station, $path))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->has('studio.setup', 6)
                    ->where('studio.setup.0', ['key' => 'logo', 'label' => 'Sube el logo de tu canal', 'done' => false, 'href' => '/perfil'])
                    ->where('studio.setup.1', ['key' => 'cover', 'label' => 'Sube tu foto de portada', 'done' => false, 'href' => '/perfil#portada'])
                    ->where('studio.setup.2.done', true)
                    ->where('studio.setup.5.key', 'team')
                    ->where('studio.setup.5.done', false));
        }
    }

    #[Test]
    public function inviting_someone_completes_the_team_step(): void
    {
        $station = Station::factory()->create();
        $this->teamMember($station, StationRole::Host);

        $this->actingAs($station->owner)
            ->get($this->studioUrl($station))
            ->assertInertia(fn (Assert $page) => $page->where('studio.setup.5', fn ($step) => $step['key'] === 'team' && $step['done'] === true));
    }

    #[Test]
    public function each_member_only_sees_the_steps_they_can_do(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($this->teamMember($station, StationRole::Manager))
            ->get($this->studioUrl($station))
            ->assertInertia(fn (Assert $page) => $page->where('studio.setup', fn ($steps) => collect($steps)->pluck('key')->all() === ['logo', 'cover', 'description', 'categories', 'hashtags']));

        $this->actingAs($this->teamMember($station, StationRole::Host))
            ->get($this->studioUrl($station))
            ->assertInertia(fn (Assert $page) => $page->has('studio.setup', 0));
    }
}
