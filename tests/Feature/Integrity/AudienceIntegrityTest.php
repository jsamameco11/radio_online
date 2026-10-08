<?php

namespace Tests\Feature\Integrity;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Integrity\Enums\AlertKind;
use App\Domain\Integrity\Enums\AlertStatus;
use App\Domain\Integrity\Enums\FollowStatus;
use App\Domain\Integrity\Support\RequestSignals;
use App\Domain\Streaming\Audience;
use App\Models\AuditLog;
use App\Models\IntegrityAlert;
use App\Models\ListenerSession;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AudienceIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private const BROWSER = ['User-Agent' => 'Mozilla/5.0 (Linux; Android 14) Chrome/129.0 Mobile', 'Accept-Language' => 'es-PE,es;q=0.9'];

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->station = Station::factory()->create();
    }

    private function radio(string $path): string
    {
        return $this->publicUrl('/radio/'.$this->station->frequency->slug.$path);
    }

    /** An account that already proved to be a real listener. */
    private function realListener(): User
    {
        $user = User::factory()->create(['created_at' => now()->subDays(5)]);
        $this->listened($user, 600);

        return $user;
    }

    private function listened(User $user, int $seconds): void
    {
        ListenerSession::query()->create([
            'station_id' => Station::factory()->create()->id,
            'user_id' => $user->id,
            'token' => (string) Str::uuid(),
            'started_at' => now()->subHours(2),
            'last_seen_at' => now()->subHour(),
            'ended_at' => now()->subHour(),
            'seconds' => $seconds,
        ]);
    }

    private function beat(string $token, ?User $user = null, array $headers = self::BROWSER, string $ip = '181.65.10.20'): void
    {
        ($user ? $this->actingAs($user) : $this)
            ->flushHeaders()
            ->withHeaders($headers)
            ->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson($this->radio('/escucha'), ['oyente' => $token])
            ->assertOk();
    }

    /** Followers of a farm: fresh accounts subscribing from one network. */
    private function farm(int $accounts, string $ip = '45.90.1.7'): void
    {
        User::factory()->count($accounts)->create()->each(fn (User $bot) => $this->actingAs($bot)
            ->withServerVariables(['REMOTE_ADDR' => $ip])
            ->post($this->radio('/suscribirme'))
            ->assertSessionHas('success'));
    }

    #[Test]
    public function a_fresh_account_subscribes_but_only_counts_once_it_listened_for_real(): void
    {
        $fresh = User::factory()->create();

        $this->actingAs($fresh)->post($this->radio('/suscribirme'))->assertSessionHas('success');

        $this->assertDatabaseHas('follows', ['user_id' => $fresh->id, 'station_id' => $this->station->id, 'status' => FollowStatus::Pending->value]);
        $this->assertSame(0, $this->station->fresh()->follower_count);

        $this->travel(25)->hours();
        $this->artisan('integrity:qualify')->assertSuccessful();
        $this->assertSame(0, $this->station->fresh()->follower_count, 'Old enough, but it never listened.');

        $this->listened($fresh, 180);
        $this->artisan('integrity:qualify')->assertSuccessful();

        $this->assertSame(1, $this->station->fresh()->follower_count);
        $this->assertDatabaseHas('follows', ['user_id' => $fresh->id, 'status' => FollowStatus::Counted->value]);

        $this->actingAs($fresh)->delete($this->radio('/suscribirme'));
        $this->assertSame(0, $this->station->fresh()->follower_count);
    }

    #[Test]
    public function a_real_listener_counts_at_once_and_a_pending_unsubscribe_takes_nothing_away(): void
    {
        $real = $this->realListener();
        $fresh = User::factory()->create();

        $this->actingAs($real)->post($this->radio('/suscribirme'));
        $this->actingAs($fresh)->post($this->radio('/suscribirme'));
        $this->assertSame(1, $this->station->fresh()->follower_count);

        $this->actingAs($fresh)->delete($this->radio('/suscribirme'));
        $this->assertSame(1, $this->station->fresh()->follower_count);
    }

    #[Test]
    public function an_account_cannot_subscribe_to_stations_non_stop(): void
    {
        config(['platform.integrity.follows_per_hour' => 2]);
        $user = $this->realListener();
        [$first, $second, $third] = Station::factory()->count(3)->create()->all();

        foreach ([$first, $second] as $station) {
            $this->actingAs($user)->post($this->publicUrl('/radio/'.$station->frequency->slug.'/suscribirme'))->assertSessionHas('success');
        }
        $this->actingAs($user)->post($this->publicUrl('/radio/'.$third->frequency->slug.'/suscribirme'))
            ->assertSessionHas('error');

        $this->assertDatabaseMissing('follows', ['user_id' => $user->id, 'station_id' => $third->id]);
    }

    #[Test]
    public function a_swarm_of_guest_players_from_one_network_counts_as_a_handful(): void
    {
        config(['platform.integrity.guests_per_network' => 3]);
        $tokens = collect(range(1, 10))->map(fn () => (string) Str::uuid());

        $tokens->each(fn (string $token) => $this->beat($token));
        $this->beat((string) Str::uuid(), ip: '190.40.2.9');
        $this->assertSame(0, $this->station->fresh()->listener_count, 'Nobody counts before the warm-up.');

        $this->travel(Audience::warmup() + 1)->seconds();
        $tokens->each(fn (string $token) => $this->beat($token));
        $this->beat(ListenerSession::query()->where('network', RequestSignals::network('190.40.2.9'))->value('token'), ip: '190.40.2.9');

        $this->assertSame(4, app(Audience::class)->count($this->station));
    }

    #[Test]
    public function an_account_counts_once_however_many_players_it_opens(): void
    {
        $user = User::factory()->create();
        $tokens = collect(range(1, 3))->map(fn () => (string) Str::uuid());

        $tokens->each(fn (string $token) => $this->beat($token, $user));
        $this->travel(Audience::warmup() + 1)->seconds();
        $tokens->each(fn (string $token) => $this->beat($token, $user));

        $this->assertSame(1, app(Audience::class)->count($this->station));
    }

    #[Test]
    public function automated_clients_and_networks_that_open_players_non_stop_never_count(): void
    {
        config(['platform.integrity.sessions_per_network' => 2]);
        $script = (string) Str::uuid();
        $noLanguage = (string) Str::uuid();
        $this->beat($script, headers: ['User-Agent' => 'python-requests/2.31', 'Accept-Language' => 'es']);
        $this->beat($noLanguage, headers: ['User-Agent' => 'Mozilla/5.0 Chrome/129.0', 'Accept-Language' => '']);
        $flood = collect(range(1, 4))->map(fn () => (string) Str::uuid());
        $flood->each(fn (string $token) => $this->beat($token, ip: '200.1.1.1'));

        $this->assertSame(2, ListenerSession::query()->where('suspect', false)->count());
        $this->assertTrue(ListenerSession::query()->where('token', $script)->value('suspect'));
        $this->assertTrue(ListenerSession::query()->where('token', $noLanguage)->value('suspect'));

        $this->travel(Audience::warmup() + 1)->seconds();
        $this->beat($script, headers: ['User-Agent' => 'python-requests/2.31', 'Accept-Language' => 'es']);
        $flood->each(fn (string $token) => $this->beat($token, ip: '200.1.1.1'));

        $this->assertSame(2, app(Audience::class)->count($this->station));
    }

    #[Test]
    public function the_scanner_flags_a_farm_and_the_staff_purges_it(): void
    {
        $real = $this->realListener();
        $this->actingAs($real)->post($this->radio('/suscribirme'));
        $this->farm(10);

        $this->artisan('integrity:scan')->assertSuccessful();

        $alert = IntegrityAlert::query()->where('kind', AlertKind::FollowCluster->value)->sole();
        $this->assertSame($this->station->id, $alert->station_id);
        $this->assertCount(10, $alert->userIds());
        $this->assertNotContains($real->id, $alert->userIds());

        $admin = $this->staff(PlatformRole::Admin);
        $this->actingAs($admin)->get($this->controlUrl('/admin/integridad'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Integrity/Index')
                ->where('counts.open', 1)
                ->where('stats.pending_follows', 10)
                ->where('alerts.data.0.kind.value', AlertKind::FollowCluster->value)
                ->where('alerts.data.0.accounts', 10));
        $this->actingAs($admin)->getJson($this->controlUrl('/admin/integridad/'.$alert->id.'/cuentas'))
            ->assertOk()
            ->assertJsonPath('total', 10)
            ->assertJsonCount(10, 'accounts')
            ->assertJsonPath('accounts.0.follow.value', FollowStatus::Pending->value);

        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/integridad/'.$alert->id.'/resolver'), ['outcome' => 'purged', 'note' => 'Granja desde un mismo proveedor'])
            ->assertSessionHas('success');

        $this->assertSame(AlertStatus::Purged, $alert->fresh()->status);
        $this->assertSame(10, User::query()->whereNotNull('flagged_at')->count());
        $this->assertSame(10, DB::table('follows')->where('status', FollowStatus::Discarded->value)->count());
        $this->assertSame(1, $this->station->fresh()->follower_count);
        $this->assertTrue(AuditLog::query()->where('action', 'integrity.accounts_flagged')->exists());
        $this->assertTrue(AuditLog::query()->where('action', 'integrity.alert_purged')->exists());

        $this->artisan('integrity:scan')->assertSuccessful();
        $this->assertSame(0, IntegrityAlert::query()->where('status', AlertStatus::Open->value)->count(), 'What the staff resolved is not raised again.');
    }

    #[Test]
    public function a_flagged_account_never_counts_until_the_staff_lifts_the_mark(): void
    {
        $user = $this->realListener();
        $this->actingAs($user)->post($this->radio('/suscribirme'));
        $this->assertSame(1, $this->station->fresh()->follower_count);

        $this->farm(8);
        $this->artisan('integrity:scan')->assertSuccessful();
        $alert = IntegrityAlert::query()->sole();
        $alert->forceFill(['evidence' => [...$alert->evidence, 'user_ids' => [$user->id]]])->save();
        $admin = $this->staff(PlatformRole::Admin);
        $this->actingAs($admin)->post($this->controlUrl('/admin/integridad/'.$alert->id.'/resolver'), ['outcome' => 'purged']);

        $this->assertNotNull($user->fresh()->flagged_at);
        $this->assertSame(0, $this->station->fresh()->follower_count);

        $token = (string) Str::uuid();
        $this->beat($token, $user->fresh());
        $this->assertTrue(ListenerSession::query()->where('token', $token)->value('suspect'));

        $this->listened($user, 300);
        $this->actingAs($admin)->post($this->controlUrl('/admin/usuarios/'.$user->id.'/quitar-marca'))->assertSessionHas('success');

        $this->assertNull($user->fresh()->flagged_at);
        $this->assertSame(1, $this->station->fresh()->follower_count);
        $this->assertTrue(AuditLog::query()->where('action', 'integrity.account_unflagged')->exists());
    }

    #[Test]
    public function moderators_dismiss_alerts_but_only_account_managers_purge_accounts(): void
    {
        $this->farm(8);
        $this->artisan('integrity:scan')->assertSuccessful();
        $alert = IntegrityAlert::query()->sole();
        $moderator = $this->staff(PlatformRole::Moderator);

        $this->actingAs($moderator)->post($this->controlUrl('/admin/integridad/'.$alert->id.'/resolver'), ['outcome' => 'purged'])->assertForbidden();
        $this->actingAs($moderator)->post($this->controlUrl('/admin/integridad/'.$alert->id.'/resolver'), ['outcome' => 'dismissed', 'note' => 'Campaña legítima en un colegio'])
            ->assertSessionHas('success');

        $this->assertSame(AlertStatus::Dismissed, $alert->fresh()->status);
        $this->assertSame(0, User::query()->whereNotNull('flagged_at')->count());
        $this->actingAs(User::factory()->create())->get($this->controlUrl('/admin/integridad'))->assertRedirect();
    }

    #[Test]
    public function a_wave_of_fresh_accounts_from_many_networks_is_detected_too(): void
    {
        collect(range(1, 22))->each(fn (int $i) => $this->farm(1, "100.64.0.{$i}"));

        $this->artisan('integrity:scan')->assertSuccessful();

        $alert = IntegrityAlert::query()->where('kind', AlertKind::FreshAccountWave->value)->sole();
        $this->assertSame(100, $alert->evidence['share']);
        $this->assertCount(22, $alert->userIds());
        $this->assertFalse(IntegrityAlert::query()->where('kind', AlertKind::FollowCluster->value)->exists());
    }
}
