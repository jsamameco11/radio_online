<?php

namespace Tests\Feature\Access;

use App\Domain\Access\Enums\Permission;
use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Access\Support\AccountCache;
use App\Domain\Stations\Enums\StationRole;
use App\Models\Station;
use App\Models\User;
use Database\Seeders\AccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AccountCacheTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(AccessSeeder::class);
    }

    /** The account as the next request loads it. */
    private function signedIn(User $user): User
    {
        return Auth::createUserProvider('users')->retrieveById($user->id);
    }

    #[Test]
    public function the_signed_in_account_and_its_access_are_served_without_queries_once_cached(): void
    {
        $user = tap(User::factory()->create())->assignRole(PlatformRole::Admin->value);
        $station = Station::factory()->create();
        $station->members()->create(['user_id' => $user->id, 'role' => StationRole::Manager]);
        $this->assertTrue($this->signedIn($user)->can(Permission::ViewDashboard->value));

        DB::enableQueryLog();
        $account = $this->signedIn($user);

        $this->assertTrue($account->exists);
        $this->assertSame($user->email, $account->email);
        $this->assertTrue($account->isStaff());
        $this->assertTrue($account->can(Permission::ViewDashboard->value));
        $this->assertTrue($account->hasStudio());
        $this->assertSame(StationRole::Manager, $account->roleIn($station));
        $this->assertSame([], DB::getQueryLog());
    }

    #[Test]
    public function an_account_found_while_signing_in_gets_its_access_from_the_cache(): void
    {
        $user = tap(User::factory()->create())->assignRole(PlatformRole::Moderator->value);
        $this->signedIn($user);

        $fresh = User::query()->findOrFail($user->id);
        DB::enableQueryLog();
        app(AccountCache::class)->preload($fresh);

        $this->assertTrue($fresh->isStaff());
        $this->assertSame([], DB::getQueryLog());
    }

    #[Test]
    public function a_missing_account_is_not_signed_in(): void
    {
        $this->assertNull(Auth::createUserProvider('users')->retrieveById(999_999));
        $this->assertNull(Auth::createUserProvider('users')->retrieveById('not-an-id'));
    }

    #[Test]
    public function profile_changes_apply_on_the_next_request(): void
    {
        $user = User::factory()->create(['name' => 'Antes']);
        $this->assertSame('Antes', $this->signedIn($user)->name);

        $user->update(['name' => 'Después']);

        $this->assertSame('Después', $this->signedIn($user)->name);
    }

    #[Test]
    public function a_new_platform_role_applies_on_the_next_request(): void
    {
        $user = User::factory()->create();
        $this->assertFalse($this->signedIn($user)->isStaff());

        $user->assignRole(PlatformRole::Moderator->value);

        $this->assertTrue($this->signedIn($user)->isStaff());
    }

    #[Test]
    public function a_removed_platform_role_applies_on_the_next_request(): void
    {
        $user = tap(User::factory()->create())->assignRole(PlatformRole::Admin->value);
        $this->assertTrue($this->signedIn($user)->isStaff());

        $user->syncRoles([PlatformRole::Listener->value]);

        $this->assertFalse($this->signedIn($user)->isStaff());
    }

    #[Test]
    public function joining_leaving_or_changing_role_in_a_team_applies_on_the_next_request(): void
    {
        $user = User::factory()->create();
        $station = Station::factory()->create();
        $this->assertFalse($this->signedIn($user)->hasStudio());

        $member = $station->members()->create(['user_id' => $user->id, 'role' => StationRole::Host]);
        $this->assertSame(StationRole::Host, $this->signedIn($user)->roleIn($station));

        $member->update(['role' => StationRole::Editor]);
        $this->assertSame(StationRole::Editor, $this->signedIn($user)->roleIn($station));

        $member->delete();
        $this->assertFalse($this->signedIn($user)->hasStudio());
    }
}
