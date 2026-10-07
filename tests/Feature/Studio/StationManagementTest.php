<?php

namespace Tests\Feature\Studio;

use App\Domain\Discovery\Enums\CategoryGroup;
use App\Domain\Stations\Enums\StationRole;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Station;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StationManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    /** @return array<string, array{string, string}> */
    public static function pages(): array
    {
        return [
            'dashboard' => ['', 'Studio/Dashboard'],
            'profile' => ['/perfil', 'Studio/Profile'],
            'topic' => ['/tema', 'Studio/Topic'],
            'stats' => ['/estadisticas', 'Studio/Stats'],
            'audience' => ['/audiencia', 'Studio/Audience'],
            'general' => ['/configuracion', 'Studio/Settings/General'],
            'frequency' => ['/configuracion/frecuencia', 'Studio/Settings/Frequency'],
            'moderation' => ['/configuracion/moderacion', 'Studio/Settings/Moderation'],
            'notifications' => ['/configuracion/notificaciones', 'Studio/Settings/Notifications'],
            'privacy' => ['/configuracion/privacidad', 'Studio/Settings/Privacy'],
            'team' => ['/configuracion/equipo', 'Studio/Settings/Team'],
            'security' => ['/configuracion/seguridad', 'Studio/Settings/Security'],
        ];
    }

    #[Test]
    #[DataProvider('pages')]
    public function owners_see_every_management_page(string $path, string $component): void
    {
        $station = Station::factory()->create();

        $this->actingAs($station->owner)
            ->get($this->studioUrl($station, $path))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component($component));
    }

    #[Test]
    public function members_without_the_permission_are_forbidden(): void
    {
        $station = Station::factory()->create();
        $editor = $this->teamMember($station, StationRole::Editor);
        $host = $this->teamMember($station, StationRole::Host);

        $this->actingAs($editor)->get($this->studioUrl($station, '/perfil'))->assertForbidden();
        $this->actingAs($editor)->get($this->studioUrl($station, '/estadisticas'))->assertForbidden();
        $this->actingAs($host)->get($this->studioUrl($station, '/configuracion'))->assertForbidden();
        $this->actingAs($host)->get($this->studioUrl($station, '/estadisticas'))->assertOk();
    }

    #[Test]
    public function members_of_another_station_cannot_manage_it(): void
    {
        $station = Station::factory()->create();
        $other = Station::factory()->create();

        $this->actingAs($other->owner)
            ->put($this->studioUrl($station, '/configuracion'), ['name' => 'Radio Pirata', 'visibility' => 'public'])
            ->assertForbidden();

        $this->assertNotSame('Radio Pirata', $station->fresh()->name);
    }

    #[Test]
    public function managers_update_the_profile_and_general_settings(): void
    {
        $station = Station::factory()->create();
        $manager = $this->teamMember($station, StationRole::Manager);
        $category = Category::query()->create(['name' => 'Noticias', 'slug' => 'noticias', 'group' => CategoryGroup::Information, 'sort_order' => 1, 'active' => true]);

        $this->actingAs($manager)
            ->put($this->studioUrl($station, '/configuracion'), ['name' => 'Radio Aurora', 'visibility' => 'unlisted'])
            ->assertSessionHasNoErrors();

        $this->assertSame('Radio Aurora', $station->fresh()->name);

        $this->actingAs($manager)
            ->put($this->studioUrl($station, '/perfil'), [
                'tagline' => 'La voz del barrio',
                'description' => 'Música y noticias todo el día.',
                'language' => 'es',
                'country' => 'PE',
                'categories' => [$category->id],
                'hashtags' => ['lima', 'cumbia'],
                'links' => ['website' => 'https://aurora.example.com'],
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame('La voz del barrio', $station->fresh()->tagline);
        $this->assertTrue(AuditLog::query()->where('action', 'like', 'station.%')->exists());
    }

    #[Test]
    public function preferences_are_validated_and_saved(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($station->owner)
            ->put($this->studioUrl($station, '/configuracion/privacidad'), [
                'show_listener_count' => false,
                'show_follower_count' => true,
                'show_top_supporters' => true,
                'allow_anonymous_gifts' => false,
                'show_team' => true,
            ])
            ->assertSessionHasNoErrors();

        $this->actingAs($station->owner)
            ->get($this->studioUrl($station, '/configuracion/privacidad'))
            ->assertInertia(fn (Assert $page) => $page->where('settings.show_listener_count', false)->where('settings.show_team', true));

        $this->actingAs($station->owner)
            ->put($this->studioUrl($station, '/configuracion/moderacion'), ['slow_mode_seconds' => 7])
            ->assertSessionHasErrors('slow_mode_seconds');
    }
}
