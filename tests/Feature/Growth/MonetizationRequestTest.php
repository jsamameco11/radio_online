<?php

namespace Tests\Feature\Growth;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Monetization\Enums\MonetizationRequestStatus;
use App\Domain\Monetization\Notifications\MonetizationApproved;
use App\Domain\Monetization\Notifications\MonetizationRejected;
use App\Domain\Stations\Enums\StationRole;
use App\Models\AuditLog;
use App\Models\MonetizationRequest;
use App\Models\Station;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class MonetizationRequestTest extends TestCase
{
    use GrowthFixtures, RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeMedia();
        Notification::fake();
        $this->travelTo($this->lima('2026-10-07 10:00'));
        $this->station = Station::factory()->create();
    }

    #[Test]
    public function a_station_below_the_thresholds_cannot_request_monetization(): void
    {
        $this->station->forceFill(['follower_count' => (int) config('platform.monetization.min_subscribers') - 1])->save();
        foreach ([3, 2, 1] as $daysAgo) {
            $this->liveSession($this->station, $this->lima('2026-10-07 20:00')->subDays($daysAgo), (int) config('platform.monetization.live_listeners'));
        }
        $owner = $this->station->owner()->sole();

        $this->actingAs($owner)
            ->get($this->studioUrl($this->station, '/monetizacion'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Monetization')
                ->where('status', 'in_progress')
                ->where('monetization.eligible', false)
                ->where('monetization.live.met', true)
                ->where('monetization.subscribers.met', false));

        $this->actingAs($owner)
            ->post($this->studioUrl($this->station, '/monetizacion/solicitud'))
            ->assertSessionHasErrors('monetization');

        $this->assertSame(0, MonetizationRequest::query()->count());
    }

    #[Test]
    public function non_consecutive_live_days_do_not_count(): void
    {
        $this->station->forceFill(['follower_count' => (int) config('platform.monetization.min_subscribers')])->save();
        foreach ([6, 4, 2] as $daysAgo) {
            $this->liveSession($this->station, $this->lima('2026-10-07 20:00')->subDays($daysAgo), (int) config('platform.monetization.live_listeners'));
        }
        $this->liveSession($this->station, $this->lima('2026-10-06 20:00'), (int) config('platform.monetization.live_listeners') - 1);

        $this->actingAs($this->station->owner()->sole())
            ->post($this->studioUrl($this->station, '/monetizacion/solicitud'))
            ->assertSessionHasErrors('monetization');

        $this->assertSame(0, MonetizationRequest::query()->count());
    }

    #[Test]
    public function an_eligible_owner_requests_monetization_once(): void
    {
        $this->makeEligible($this->station);
        $owner = $this->station->owner()->sole();

        $this->actingAs($owner)
            ->get($this->studioUrl($this->station, '/monetizacion'))
            ->assertInertia(fn (Assert $page) => $page->where('status', 'eligible')->where('monetization.live.best_run', 3));

        $this->actingAs($owner)
            ->post($this->studioUrl($this->station, '/monetizacion/solicitud'))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->actingAs($owner)
            ->post($this->studioUrl($this->station, '/monetizacion/solicitud'))
            ->assertSessionHasErrors('monetization');

        $request = MonetizationRequest::query()->sole();
        $this->assertSame(MonetizationRequestStatus::Pending, $request->status);
        $this->assertSame((int) config('platform.monetization.min_subscribers'), $request->subscribers);
        $this->assertCount(3, $request->snapshot['qualifying_days']);
        $this->assertSame(1, AuditLog::query()->where('action', 'monetization.request')->count());

        $this->actingAs($owner)
            ->get($this->studioUrl($this->station, '/monetizacion'))
            ->assertInertia(fn (Assert $page) => $page->where('status', 'pending')->where('request.status.value', 'pending'));
    }

    #[Test]
    public function only_the_owner_may_request_monetization(): void
    {
        $this->makeEligible($this->station);

        foreach ([StationRole::Manager, StationRole::Host] as $role) {
            $member = $this->teamMember($this->station, $role);
            $this->actingAs($member)->get($this->studioUrl($this->station, '/monetizacion'))->assertForbidden();
            $this->actingAs($member)->post($this->studioUrl($this->station, '/monetizacion/solicitud'))->assertForbidden();
        }

        $staff = $this->staff();
        $this->actingAs($staff)->get($this->studioUrl($this->station, '/monetizacion'))->assertOk()->assertInertia(fn (Assert $page) => $page->where('canAct', false));
        $this->actingAs($staff)->post($this->studioUrl($this->station, '/monetizacion/solicitud'))->assertForbidden();

        $this->assertSame(0, MonetizationRequest::query()->count());
    }

    #[Test]
    public function reviewing_requires_the_monetization_review_permission(): void
    {
        $request = $this->pendingRequest();

        $this->actingAs($this->staff(PlatformRole::Moderator))->get($this->controlUrl('/admin/monetizacion'))->assertForbidden();
        $this->actingAs($this->staff(PlatformRole::Moderator))
            ->post($this->controlUrl('/admin/monetizacion/'.$request->id.'/aprobar'))
            ->assertForbidden();

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->get($this->controlUrl('/admin/monetizacion'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Monetization/Index')
                ->where('counts.pending', 1)
                ->has('requests.data', 1)
                ->where('requests.data.0.station.display_name', $this->station->fresh()->displayName()));

        $this->assertNull($this->station->fresh()->monetized_at);
    }

    #[Test]
    public function approving_turns_the_station_into_a_monetized_radio(): void
    {
        $request = $this->pendingRequest();
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/monetizacion/'.$request->id.'/aprobar'), ['note' => '¡Felicitaciones!'])
            ->assertSessionHasNoErrors();

        $this->assertNotNull($this->station->fresh()->monetized_at);
        $this->assertSame(MonetizationRequestStatus::Approved, $request->fresh()->status);
        $this->assertSame($admin->id, $request->fresh()->reviewed_by);
        $this->assertSame(1, AuditLog::query()->where('action', 'monetization.approve')->where('station_id', $this->station->id)->count());
        Notification::assertSentTo($this->station->owner()->sole(), MonetizationApproved::class);

        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/monetizacion/'.$request->id.'/rechazar'), ['note' => 'Ya no aplica'])
            ->assertSessionHasErrors('request');

        $this->actingAs($this->station->owner()->sole())
            ->get($this->studioUrl($this->station, '/monetizacion'))
            ->assertInertia(fn (Assert $page) => $page->where('status', 'monetized'));
    }

    #[Test]
    public function a_rejected_station_waits_before_asking_again(): void
    {
        $request = $this->pendingRequest();
        $owner = $this->station->owner()->sole();

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl('/admin/monetizacion/'.$request->id.'/rechazar'), ['note' => ''])
            ->assertSessionHasErrors('note');
        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl('/admin/monetizacion/'.$request->id.'/rechazar'), ['note' => 'Detectamos audiencia inusual.'])
            ->assertSessionHasNoErrors();

        $this->assertNull($this->station->fresh()->monetized_at);
        $this->assertSame(1, AuditLog::query()->where('action', 'monetization.reject')->count());
        Notification::assertSentTo($owner, MonetizationRejected::class);

        $this->actingAs($owner)
            ->get($this->studioUrl($this->station, '/monetizacion'))
            ->assertInertia(fn (Assert $page) => $page->where('status', 'rejected')->where('request.review_note', 'Detectamos audiencia inusual.')->whereNot('retryAt', null));

        $this->actingAs($owner)->post($this->studioUrl($this->station, '/monetizacion/solicitud'))->assertSessionHasErrors('monetization');

        $this->travel(8)->days();
        $this->makeEligible($this->station);
        $this->actingAs($owner)->post($this->studioUrl($this->station, '/monetizacion/solicitud'))->assertSessionHasNoErrors();
        $this->assertSame(2, MonetizationRequest::query()->count());
    }

    #[Test]
    public function another_station_never_sees_this_request(): void
    {
        $this->pendingRequest();
        $other = Station::factory()->create();

        $this->actingAs($other->owner()->sole())
            ->get($this->studioUrl($other, '/monetizacion'))
            ->assertInertia(fn (Assert $page) => $page->where('request', null)->where('status', 'in_progress'));

        $this->actingAs($other->owner()->sole())->get($this->studioUrl($this->station, '/monetizacion'))->assertForbidden();
    }

    private function pendingRequest(): MonetizationRequest
    {
        $this->makeEligible($this->station);
        $this->actingAs($this->station->owner()->sole())->post($this->studioUrl($this->station, '/monetizacion/solicitud'));

        return MonetizationRequest::query()->sole();
    }
}
