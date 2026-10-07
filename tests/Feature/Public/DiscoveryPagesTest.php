<?php

namespace Tests\Feature\Public;

use App\Domain\Stations\Actions\OpenStation;
use App\Domain\Stations\Enums\StationVisibility;
use App\Models\Category;
use App\Models\Frequency;
use App\Models\Station;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DiscoveryPagesTest extends TestCase
{
    use RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        $this->seed(CategorySeeder::class);
        $frequency = Frequency::factory()->create(['frequency' => '89.30', 'label' => '89.30', 'slug' => '89-30']);
        $this->station = app(OpenStation::class)->handle(
            User::factory()->create(),
            $frequency,
            'Radio Aurora',
            [Category::query()->value('id')],
            ['Salsa'],
        );
        Station::factory()->live()->create(['name' => 'Radio Cumbre']);
    }

    /** @return array<string, array{string, string}> */
    public static function pages(): array
    {
        return [
            'home' => ['/', 'Public/Home'],
            'explore' => ['/explorar?categoria=nada&orden=raro', 'Public/Explore'],
            'live' => ['/en-vivo', 'Public/Live'],
            'dial' => ['/dial', 'Public/Dial'],
            'categories' => ['/categorias', 'Public/Categories'],
            'search' => ['/buscar', 'Public/Search'],
            'following' => ['/mis-radios', 'Public/Following'],
            'history' => ['/historial', 'Public/History'],
            'create station' => ['/crear-mi-radio', 'Public/CreateStation'],
        ];
    }

    #[Test]
    #[DataProvider('pages')]
    public function verified_listeners_can_open_every_page(string $path, string $component): void
    {
        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl($path))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component($component));
    }

    #[Test]
    #[DataProvider('pages')]
    public function guests_are_sent_to_sign_in(string $path): void
    {
        $this->get($this->publicUrl($path))->assertRedirect($this->publicUrl('/ingresar'));
    }

    #[Test]
    public function unverified_listeners_must_confirm_their_email_first(): void
    {
        $response = $this->actingAs(User::factory()->unverified()->create())->get($this->publicUrl('/explorar'));

        $response->assertRedirect();
        $this->assertStringEndsWith(route('verification.notice', absolute: false), (string) $response->headers->get('Location'));
    }

    #[Test]
    public function the_home_page_lists_stations_on_air(): void
    {
        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl('/'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Home')
                ->has('onAir', 1)
                ->where('onAir.0.name', 'Radio Cumbre')
                ->where('stats.stations', 2));
    }

    #[Test]
    public function explore_can_show_only_stations_on_air(): void
    {
        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl('/explorar?en-vivo=1'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('stations.data', 1)
                ->where('stations.data.0.name', 'Radio Cumbre')
                ->where('filters.en_vivo', true));
    }

    #[Test]
    public function a_station_page_shows_the_station_with_its_frequency(): void
    {
        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl('/radio/89-30'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Station')
                ->where('station.display_name', '89.30 FM · Radio Aurora')
                ->where('isFollowing', false)
                ->has('reportReasons'));
    }

    #[Test]
    public function unlisted_stations_open_by_link_but_suspended_ones_do_not(): void
    {
        $listener = User::factory()->create();
        $this->station->update(['visibility' => StationVisibility::Unlisted]);

        $this->actingAs($listener)->get($this->publicUrl('/radio/89-30'))->assertOk();

        $suspended = Station::factory()->suspended()->create();
        $this->actingAs($listener)->get($this->publicUrl('/radio/'.$suspended->frequency->slug))->assertNotFound();
    }

    #[Test]
    public function category_and_hashtag_pages_list_their_stations(): void
    {
        $listener = User::factory()->create();
        $category = $this->station->categories()->firstOrFail();

        $this->actingAs($listener)
            ->get($this->publicUrl('/categorias/'.$category->slug))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Category')
                ->where('stations.data.0.name', 'Radio Aurora'));

        $this->actingAs($listener)
            ->get($this->publicUrl('/hashtag/salsa'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Hashtag')
                ->where('stations.data.0.name', 'Radio Aurora'));
    }

    #[Test]
    public function searching_a_frequency_tunes_the_station_on_it(): void
    {
        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl('/buscar?q=89.3'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('kind', 'frequency')
                ->where('tuned.label', '89.30')
                ->where('tuned.station.name', 'Radio Aurora'));
    }

    #[Test]
    public function searching_a_hashtag_finds_the_stations_that_use_it(): void
    {
        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl('/buscar?q=%23salsa'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('kind', 'hashtag')
                ->where('hashtag.exists', true)
                ->has('stations.data', 1));
    }

    #[Test]
    public function searching_text_matches_station_names(): void
    {
        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl('/buscar?q=cumbre'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('kind', 'text')
                ->has('stations.data', 1)
                ->where('stations.data.0.name', 'Radio Cumbre'));
    }
}
