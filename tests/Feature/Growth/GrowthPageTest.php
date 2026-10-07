<?php

namespace Tests\Feature\Growth;

use App\Domain\Growth\Achievements;
use App\Domain\Growth\GrowthProgram;
use App\Domain\Monetization\Notifications\MonetizationReady;
use App\Domain\Stations\Enums\StationRole;
use App\Models\Station;
use App\Models\StationAchievement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class GrowthPageTest extends TestCase
{
    use GrowthFixtures, RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeMedia();
        $this->travelTo($this->lima('2026-10-07 10:00'));
        $this->station = Station::factory()->create();
    }

    #[Test]
    public function a_new_station_sees_its_first_goal_and_a_fresh_streak(): void
    {
        $this->actingAs($this->station->owner()->sole())
            ->get($this->studioUrl($this->station, '/crecimiento'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Growth')
                ->where('growth.next_goal.key', 'first_episode')
                ->where('growth.streak.state', 'fresh')
                ->where('growth.streak.current', 0)
                ->where('growth.achieved_count', 0)
                ->has('growth.calendar', GrowthProgram::CALENDAR_DAYS)
                ->where('growth.goals.0.key', 'first_episode')
                ->where('growth.goals.1.key', 'first_live')
                ->where('growth.goals.2.key', 'streak_2')
                ->where('growth.goals.3.key', 'streak_3')
                ->where('growth.monetization.eligible', false)
                ->where('growth.monetization.subscribers.target', (int) config('platform.monetization.min_subscribers'))
                ->where('growth.monetization.live.threshold', (int) config('platform.monetization.live_listeners'))
                ->where('shareUrl', $this->publicUrl('/radio/'.$this->station->frequency->slug))
                ->where('canMonetize', true));
    }

    #[Test]
    public function the_streak_follows_lima_days_across_midnight(): void
    {
        $this->liveSession($this->station, $this->lima('2026-10-05 23:30'));
        $this->liveSession($this->station, $this->lima('2026-10-06 00:30'));
        $this->publishedEpisode($this->station, $this->lima('2026-10-07 08:00'));

        $this->actingAs($this->station->owner()->sole())
            ->get($this->studioUrl($this->station, '/crecimiento'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('growth.streak.current', 3)
                ->where('growth.streak.best', 3)
                ->where('growth.streak.active_today', true)
                ->where('growth.streak.headline', '¡Llevas 3 días seguidos!')
                ->where('growth.calendar.27.live', true)
                ->where('growth.calendar.28.live', true)
                ->where('growth.calendar.29.episode', true)
                ->where('growth.goals.3.achieved', true)
                ->where('growth.next_goal.key', 'subscribers_10'));
    }

    #[Test]
    public function a_broadcast_late_at_night_in_lima_belongs_to_that_lima_day(): void
    {
        $this->liveSession($this->station, $this->lima('2026-10-05 23:30'));
        $this->liveSession($this->station, $this->lima('2026-10-07 09:00'));

        $this->actingAs($this->station->owner()->sole())
            ->get($this->studioUrl($this->station, '/crecimiento'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('growth.streak.current', 1)
                ->where('growth.calendar.28.live', false));
    }

    #[Test]
    public function yesterdays_streak_is_still_alive_until_midnight(): void
    {
        $this->liveSession($this->station, $this->lima('2026-10-05 20:00'));
        $this->liveSession($this->station, $this->lima('2026-10-06 20:00'));

        $this->actingAs($this->station->owner()->sole())
            ->get($this->studioUrl($this->station, '/crecimiento'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('growth.streak.current', 2)
                ->where('growth.streak.state', 'at_risk')
                ->where('growth.streak.active_today', false));
    }

    #[Test]
    public function milestones_are_unlocked_once_and_stay_unlocked(): void
    {
        $this->liveSession($this->station, $this->lima('2026-10-06 20:00'), peak: 12);
        $this->station->forceFill(['follower_count' => 10])->save();
        $owner = $this->station->owner()->sole();

        $this->actingAs($owner)
            ->get($this->studioUrl($this->station, '/crecimiento'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('growth.goals.1.key', 'first_live')
                ->where('growth.goals.1.achieved', true)
                ->where('growth.goals.1.fresh', true)
                ->where('growth.achieved_count', 3)
                ->has('growth.recent', 3));

        $keys = StationAchievement::query()->where('station_id', $this->station->id)->pluck('key')->sort()->values()->all();
        $this->assertSame(['first_live', 'live_peak_10', 'subscribers_10'], $keys);

        $this->travel(1)->hours();
        $this->station->forceFill(['follower_count' => 3])->save();

        $this->actingAs($owner)
            ->get($this->studioUrl($this->station, '/crecimiento'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('growth.goals.1.fresh', false)
                ->where('growth.achieved_count', 3));

        $this->assertSame(3, StationAchievement::query()->where('station_id', $this->station->id)->count());
    }

    #[Test]
    public function the_daily_sweep_unlocks_milestones_and_tells_the_owner_once_when_monetization_is_possible(): void
    {
        Notification::fake();
        $this->makeEligible($this->station);

        Artisan::call('growth:sweep');
        Artisan::call('growth:sweep');

        $this->assertTrue(StationAchievement::query()->where('station_id', $this->station->id)->where('key', Achievements::MONETIZATION_READY)->exists());
        Notification::assertSentToTimes($this->station->owner()->sole(), MonetizationReady::class, 1);
    }

    #[Test]
    public function hosts_see_the_growth_page_and_editors_do_not(): void
    {
        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->get($this->studioUrl($this->station, '/crecimiento'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('canMonetize', false));

        $this->actingAs($this->teamMember($this->station, StationRole::Editor))
            ->get($this->studioUrl($this->station, '/crecimiento'))
            ->assertForbidden();
    }

    #[Test]
    public function the_dashboard_shows_the_growth_widget(): void
    {
        $this->liveSession($this->station, $this->lima('2026-10-07 08:00'));

        $this->actingAs($this->station->owner()->sole())
            ->get($this->studioUrl($this->station))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Dashboard')
                ->where('growth.streak.current', 1)
                ->where('growth.next_goal.key', 'first_episode')
                ->has('growth.week', 7)
                ->where('growth.monetization.subscribers.target', (int) config('platform.monetization.min_subscribers'))
                ->where('monetized', false));
    }
}
