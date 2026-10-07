<?php

namespace Tests\Feature\Public;

use App\Domain\Moderation\Enums\ReportReason;
use App\Models\Report;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FollowAndReportTest extends TestCase
{
    use RefreshDatabase;

    private Station $station;

    private User $listener;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        $this->station = Station::factory()->create();
        $this->listener = User::factory()->create();
    }

    private function stationUrl(string $path = ''): string
    {
        return $this->publicUrl('/radio/'.$this->station->frequency->slug.$path);
    }

    #[Test]
    public function listeners_follow_a_station_once(): void
    {
        $this->actingAs($this->listener)->post($this->stationUrl('/suscribirme'))->assertRedirect()->assertSessionHas('success');
        $this->actingAs($this->listener)->post($this->stationUrl('/suscribirme'))->assertRedirect();

        $this->assertSame(1, $this->station->fresh()->follower_count);
        $this->assertTrue($this->station->followers()->whereKey($this->listener->id)->exists());

        $this->actingAs($this->listener)
            ->get($this->publicUrl('/mis-radios'))
            ->assertInertia(fn (Assert $page) => $page->has('stations.data', 1));
    }

    #[Test]
    public function listeners_unfollow_a_station(): void
    {
        $this->actingAs($this->listener)->post($this->stationUrl('/suscribirme'));
        $this->actingAs($this->listener)->delete($this->stationUrl('/suscribirme'))->assertRedirect();
        $this->actingAs($this->listener)->delete($this->stationUrl('/suscribirme'))->assertRedirect();

        $this->assertSame(0, $this->station->fresh()->follower_count);
        $this->assertFalse($this->station->followers()->whereKey($this->listener->id)->exists());
    }

    #[Test]
    public function a_listener_keeps_a_single_open_report_per_station(): void
    {
        $this->actingAs($this->listener)->post($this->stationUrl('/reportar'), ['reason' => 'spam'])->assertSessionHas('success');
        $this->actingAs($this->listener)->post($this->stationUrl('/reportar'), ['reason' => 'harassment', 'details' => 'Insultos al aire.']);

        $report = Report::query()->sole();
        $this->assertSame(ReportReason::Harassment, $report->reason);
        $this->assertSame('station', $report->reportable_type);
        $this->assertTrue($report->reportable->is($this->station));
    }

    #[Test]
    public function reporting_other_reasons_requires_details(): void
    {
        $this->actingAs($this->listener)
            ->post($this->stationUrl('/reportar'), ['reason' => 'other'])
            ->assertSessionHasErrors('details');

        $this->actingAs($this->listener)
            ->post($this->stationUrl('/reportar'), ['reason' => 'nonsense'])
            ->assertSessionHasErrors('reason');

        $this->assertSame(0, Report::query()->count());
    }

    #[Test]
    public function guests_cannot_follow_or_report(): void
    {
        $this->post($this->stationUrl('/suscribirme'))->assertRedirect($this->publicUrl('/ingresar'));
        $this->post($this->stationUrl('/reportar'), ['reason' => 'spam'])->assertRedirect($this->publicUrl('/ingresar'));

        $this->assertSame(0, Report::query()->count());
    }
}
