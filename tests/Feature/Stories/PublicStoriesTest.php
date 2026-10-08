<?php

namespace Tests\Feature\Stories;

use App\Domain\Moderation\Enums\ReportStatus;
use App\Models\Report;
use App\Models\Station;
use App\Models\StationStory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PublicStoriesTest extends TestCase
{
    use RefreshDatabase, StoryFixtures;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeMedia();
        $this->station = Station::factory()->create();
    }

    private function stationUrl(Station $station, string $path = ''): string
    {
        return $this->publicUrl('/radio/'.$station->frequency->slug.'/estados'.$path);
    }

    /** The same guest across requests: their session cookie goes along. */
    private function asGuest(string $session = 'a'): static
    {
        return $this->withCredentials()->withCookie((string) config('session.cookie'), str_repeat($session, 40));
    }

    #[Test]
    public function guests_watch_the_active_stories_of_a_station(): void
    {
        $text = $this->textStory($this->station);
        $photo = $this->storedStory($this->station, ['created_at' => now()->subHours(3)]);
        $this->storedStory($this->station, ['expires_at' => now()->subMinute()]);
        $this->storedStory(Station::factory()->create());

        $this->getJson($this->stationUrl($this->station))
            ->assertOk()
            ->assertJsonPath('station.frequency.slug', $this->station->frequency->slug)
            ->assertJsonCount(2, 'stories')
            ->assertJsonPath('stories.0.id', $photo->id)
            ->assertJsonPath('stories.0.media_url', Storage::disk(config('filesystems.media.public'))->url($photo->media_key))
            ->assertJsonPath('stories.1.id', $text->id)
            ->assertJsonPath('stories.1.background', 'royal')
            ->assertJsonPath('stories.1.seen', false)
            ->assertJsonMissingPath('stories.0.views_count');
    }

    #[Test]
    public function a_view_counts_once_per_viewer_and_never_for_the_author(): void
    {
        $story = $this->storedStory($this->station);
        $url = $this->stationUrl($this->station, "/{$story->id}/visto");

        $this->asGuest()->postJson($url)->assertOk();
        $this->asGuest()->postJson($url)->assertOk();
        $this->assertSame(1, $story->refresh()->views_count);

        $this->asGuest()->getJson($this->stationUrl($this->station))->assertJsonPath('stories.0.seen', true);
        $this->asGuest('b')->getJson($this->stationUrl($this->station))->assertJsonPath('stories.0.seen', false);

        $listener = User::factory()->create();
        $this->actingAs($listener)->postJson($url)->assertOk();
        $this->actingAs($listener)->postJson($url)->assertOk();
        $this->actingAs($this->station->owner)->postJson($url)->assertOk();

        $this->assertSame(2, $story->refresh()->views_count);
        $this->assertDatabaseHas('station_story_views', ['story_id' => $story->id, 'viewer_key' => 'u:'.$listener->id, 'user_id' => $listener->id]);
        $this->assertDatabaseCount('station_story_views', 2);
    }

    #[Test]
    public function expired_or_foreign_stories_cannot_be_viewed(): void
    {
        $expired = $this->storedStory($this->station, ['expires_at' => now()->subMinute()]);
        $foreign = $this->storedStory(Station::factory()->create());

        $this->postJson($this->stationUrl($this->station, "/{$expired->id}/visto"))->assertNotFound();
        $this->postJson($this->stationUrl($this->station, "/{$foreign->id}/visto"))->assertNotFound();
        $this->assertSame(0, StationStory::acrossStations()->sum('views_count'));
    }

    #[Test]
    public function the_rail_puts_followed_then_live_then_recent_stations_first(): void
    {
        $recent = Station::factory()->create();
        $live = Station::factory()->live()->create();
        $followed = Station::factory()->create();
        $expiredOnly = Station::factory()->create();
        $hidden = Station::factory()->suspended()->create();
        $this->storedStory($this->station, ['created_at' => now()->subHours(5)]);
        $this->storedStory($recent, ['created_at' => now()->subMinutes(5)]);
        $this->storedStory($live, ['created_at' => now()->subHours(10)]);
        $seen = $this->storedStory($followed, ['created_at' => now()->subHours(20)]);
        $this->storedStory($expiredOnly, ['expires_at' => now()->subMinute()]);
        $this->storedStory($hidden);

        $this->getJson($this->publicUrl('/estados'))
            ->assertOk()
            ->assertJsonCount(4, 'stations')
            ->assertJsonPath('stations.0.station.id', $live->id)
            ->assertJsonPath('stations.1.station.id', $recent->id)
            ->assertJsonPath('stations.2.station.id', $this->station->id)
            ->assertJsonPath('stations.3.station.id', $followed->id)
            ->assertJsonPath('stations.0.count', 1)
            ->assertJsonPath('stations.0.seen', false);

        $listener = User::factory()->create();
        $listener->follows()->attach($followed->id);
        $this->actingAs($listener)->postJson($this->stationUrl($followed, "/{$seen->id}/visto"))->assertOk();

        $this->actingAs($listener)->getJson($this->publicUrl('/estados'))
            ->assertJsonPath('stations.0.station.id', $followed->id)
            ->assertJsonPath('stations.0.seen', true)
            ->assertJsonPath('stations.1.station.id', $live->id)
            ->assertJsonPath('stations.1.seen', false);
    }

    #[Test]
    public function signed_in_listeners_report_a_story_for_moderation(): void
    {
        $story = $this->textStory($this->station);
        $url = $this->stationUrl($this->station, "/{$story->id}/reportar");

        $this->postJson($url, ['reason' => 'spam'])->assertUnauthorized();
        $this->actingAs(User::factory()->create())->postJson($url, ['reason' => 'spam'])->assertOk();

        $report = Report::query()->sole();
        $this->assertSame('station_story', $report->reportable_type);
        $this->assertSame($story->id, $report->reportable_id);

        $this->actingAs($this->staff())
            ->get($this->controlUrl('/admin/moderacion?type=station_story'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('reports.data.0.target.type', 'station_story')
                ->where('reports.data.0.target.excerpt', $story->text)
                ->where('reports.data.0.target.station.id', $this->station->id));
    }

    #[Test]
    public function pruning_deletes_expired_stories_and_their_files_but_keeps_reported_ones(): void
    {
        $active = $this->storedStory($this->station);
        $expired = $this->storedStory($this->station, ['expires_at' => now()->subMinute()]);
        $reported = $this->storedStory($this->station, ['expires_at' => now()->subHour()]);
        $listener = User::factory()->create();
        Report::query()->create([
            'reporter_id' => $listener->id,
            'reportable_type' => 'station_story',
            'reportable_id' => $reported->id,
            'reason' => 'spam',
            'status' => ReportStatus::Open,
        ]);
        $this->actingAs($listener)->postJson($this->stationUrl($this->station, "/{$active->id}/visto"));

        $this->artisan('stories:prune')->expectsOutput('Estados eliminados: 1')->assertSuccessful();

        $disk = Storage::disk(config('filesystems.media.public'));
        $this->assertDatabaseMissing('station_stories', ['id' => $expired->id]);
        $disk->assertMissing($expired->media_key);
        $disk->assertExists([$active->media_key, $reported->media_key]);
        $this->assertDatabaseHas('station_stories', ['id' => $active->id]);
        $this->assertDatabaseHas('station_stories', ['id' => $reported->id]);
        $this->assertDatabaseCount('station_story_views', 1);
    }
}
