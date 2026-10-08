<?php

namespace Tests\Feature\Public;

use App\Models\Station;
use App\Models\StationRating;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RateStationTest extends TestCase
{
    use RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        $this->station = Station::factory()->create(['listener_count' => 7]);
    }

    private function rateUrl(?Station $station = null): string
    {
        $station ??= $this->station;

        return $this->publicUrl('/radio/'.$station->frequency->slug.'/calificar');
    }

    #[Test]
    public function guests_see_the_score_and_who_is_connected_but_cannot_rate(): void
    {
        $this->station->forceFill(['rating_average' => 4.5, 'rating_count' => 2])->save();

        $this->get($this->publicUrl('/radio/'.$this->station->frequency->slug))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('station.listener_count', 7)
                ->where('station.rating_average', 4.5)
                ->where('station.rating_count', 2)
                ->where('myRating', null));

        $this->post($this->rateUrl(), ['stars' => 5])->assertRedirect($this->publicUrl('/ingresar'));
        $this->assertSame(0, StationRating::query()->count());
    }

    #[Test]
    public function an_unverified_account_cannot_rate(): void
    {
        $this->actingAs(User::factory()->unverified()->create())
            ->post($this->rateUrl(), ['stars' => 5])
            ->assertRedirect($this->publicUrl('/verificar-correo'));

        $this->assertSame(0, $this->station->fresh()->rating_count);
    }

    #[Test]
    public function a_listener_rates_once_and_can_change_the_score(): void
    {
        $listener = User::factory()->create();
        $other = User::factory()->create();

        $this->actingAs($listener)->post($this->rateUrl(), ['stars' => 5])->assertRedirect()->assertSessionHas('success');
        $this->actingAs($other)->post($this->rateUrl(), ['stars' => 3])->assertRedirect();

        $station = $this->station->fresh();
        $this->assertSame(2, $station->rating_count);
        $this->assertEquals(4.0, $station->rating_average);

        $this->actingAs($listener)->post($this->rateUrl(), ['stars' => 1])->assertRedirect();

        $station = $this->station->fresh();
        $this->assertSame(2, $station->rating_count);
        $this->assertEquals(2.0, $station->rating_average);
        $this->assertSame(1, StationRating::query()->where('user_id', $listener->id)->count());
        $this->assertSame(1, StationRating::query()->where('user_id', $listener->id)->value('stars'));

        $this->actingAs($listener)
            ->get($this->publicUrl('/radio/'.$this->station->frequency->slug))
            ->assertInertia(fn (Assert $page) => $page
                ->where('myRating', 1)
                ->where('station.rating_count', 2)
                ->where('station.listener_count', 7));
    }

    #[Test]
    public function stars_must_be_between_one_and_five(): void
    {
        $listener = User::factory()->create();

        $this->actingAs($listener)->post($this->rateUrl(), ['stars' => 0])->assertSessionHasErrors('stars');
        $this->actingAs($listener)->post($this->rateUrl(), ['stars' => 6])->assertSessionHasErrors('stars');
        $this->actingAs($listener)->post($this->rateUrl(), [])->assertSessionHasErrors('stars');

        $this->assertSame(0, StationRating::query()->count());
    }

    #[Test]
    public function a_suspended_station_cannot_be_rated(): void
    {
        $suspended = Station::factory()->suspended()->create();

        $this->actingAs(User::factory()->create())
            ->post($this->rateUrl($suspended), ['stars' => 4])
            ->assertNotFound();
    }
}
