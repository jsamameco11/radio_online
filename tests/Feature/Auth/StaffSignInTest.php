<?php

namespace Tests\Feature\Auth;

use App\Domain\Access\Enums\PlatformRole;
use App\Models\User;
use Database\Seeders\AccessSeeder;
use Database\Seeders\SuperAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StaffSignInTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'clave-del-panel-1';

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        $this->seed(AccessSeeder::class);
    }

    private function staffMember(PlatformRole $role = PlatformRole::SuperAdmin, string $username = 'adminradio'): User
    {
        return tap(User::factory()->create(['username' => $username, 'password' => self::PASSWORD]))->assignRole($role->value);
    }

    #[Test]
    public function the_control_panel_asks_for_a_username_and_password(): void
    {
        $this->get($this->controlUrl('/ingresar'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Auth/Login')->where('app.host', 'control'));
    }

    #[Test]
    public function staff_sign_in_to_the_panel_with_their_username(): void
    {
        $admin = $this->staffMember();

        $this->post($this->controlUrl('/ingresar'), ['username' => ' AdminRadio ', 'password' => self::PASSWORD])
            ->assertRedirect($this->controlUrl('/admin'));

        $this->assertAuthenticatedAs($admin);
        $this->get($this->controlUrl('/admin'))->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.login', 'actor_id' => $admin->id]);
        $this->assertNotNull($admin->fresh()->last_login_at);
    }

    #[Test]
    public function the_username_and_password_are_verified_once_per_sign_in(): void
    {
        $this->staffMember();
        DB::enableQueryLog();

        $this->post($this->controlUrl('/ingresar'), ['username' => 'adminradio', 'password' => self::PASSWORD])
            ->assertRedirect($this->controlUrl('/admin'));

        $lookups = collect(DB::getQueryLog())->filter(fn (array $query) => str_contains($query['query'], '"username" = ?'));
        $this->assertCount(1, $lookups);
    }

    #[Test]
    public function staff_with_two_factor_authentication_are_still_challenged(): void
    {
        $this->staffMember()->forceFill([
            'two_factor_secret' => encrypt('secret'),
            'two_factor_confirmed_at' => now(),
        ])->save();

        $this->post($this->controlUrl('/ingresar'), ['username' => 'adminradio', 'password' => self::PASSWORD])
            ->assertRedirect($this->controlUrl('/verificacion-en-dos-pasos'));

        $this->assertGuest();
    }

    #[Test]
    public function staff_go_back_to_the_page_they_wanted_after_signing_in(): void
    {
        $this->staffMember();

        $this->get($this->controlUrl('/admin/usuarios'))->assertRedirect('/ingresar');

        $this->post($this->controlUrl('/ingresar'), ['username' => 'adminradio', 'password' => self::PASSWORD])
            ->assertRedirect($this->controlUrl('/admin/usuarios'));
    }

    #[Test]
    public function a_wrong_password_is_refused(): void
    {
        $this->staffMember();

        $this->post($this->controlUrl('/ingresar'), ['username' => 'adminradio', 'password' => 'otra-clave'])
            ->assertSessionHasErrors(['username' => 'El usuario o la contraseña no son correctos.']);

        $this->assertGuest();
    }

    #[Test]
    public function accounts_outside_the_staff_cannot_sign_in_to_the_panel(): void
    {
        User::factory()->create(['username' => 'oyente', 'password' => self::PASSWORD]);

        $this->post($this->controlUrl('/ingresar'), ['username' => 'oyente', 'password' => self::PASSWORD])->assertSessionHasErrors('username');

        $this->assertGuest();
    }

    #[Test]
    public function the_staff_password_only_works_on_the_control_host(): void
    {
        $this->staffMember();

        $this->post($this->publicUrl('/ingresar'), ['username' => 'adminradio', 'password' => self::PASSWORD])->assertSessionHasErrors('username');
        $this->post($this->consoleUrl('/ingresar'), ['username' => 'adminradio', 'password' => self::PASSWORD])->assertSessionHasErrors('username');

        $this->assertGuest();
    }

    #[Test]
    public function the_first_super_admin_comes_from_the_environment(): void
    {
        config(['platform.super_admin' => ['name' => 'Renzo', 'username' => 'AdminRadio', 'email' => 'admin@turadioonline.test', 'password' => self::PASSWORD]]);

        $this->seed(SuperAdminSeeder::class);

        $admin = User::query()->sole();
        $this->assertSame('adminradio', $admin->username);
        $this->assertTrue(Hash::check(self::PASSWORD, $admin->password));
        $this->assertTrue($admin->isSuperAdmin());
        $this->assertTrue($admin->hasVerifiedEmail());

        $admin->forceFill(['password' => 'una-clave-nueva'])->save();
        $this->seed(SuperAdminSeeder::class);

        $this->assertSame(1, User::query()->count());
        $this->assertTrue(Hash::check('una-clave-nueva', $admin->fresh()->password));
    }

    #[Test]
    public function an_existing_super_admin_receives_the_username_once(): void
    {
        $existing = tap(User::factory()->create(['email' => 'admin@turadioonline.test']))->assignRole(PlatformRole::SuperAdmin->value);
        config(['platform.super_admin' => ['name' => 'Renzo', 'username' => 'adminradio', 'email' => 'admin@turadioonline.test', 'password' => self::PASSWORD]]);

        $this->seed(SuperAdminSeeder::class);

        $existing->refresh();
        $this->assertSame('adminradio', $existing->username);
        $this->assertTrue(Hash::check(self::PASSWORD, $existing->password));
    }

    #[Test]
    public function admins_give_a_staff_member_access_to_the_panel(): void
    {
        $admin = $this->staffMember();
        $moderator = tap(User::factory()->create(['password' => null]))->assignRole(PlatformRole::Moderator->value);

        $this->actingAs($admin)
            ->put($this->controlUrl("/admin/usuarios/{$moderator->id}/acceso"), ['username' => 'moderadora'])
            ->assertSessionHasErrors('password');

        $this->actingAs($admin)
            ->put($this->controlUrl("/admin/usuarios/{$moderator->id}/acceso"), ['username' => 'Moderadora', 'password' => 'clave-segura-1', 'password_confirmation' => 'clave-segura-1'])
            ->assertRedirect()
            ->assertSessionHas('success');

        $moderator->refresh();
        $this->assertSame('moderadora', $moderator->username);
        $this->assertTrue(Hash::check('clave-segura-1', $moderator->password));
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.staff_credentials_set', 'subject_id' => (string) $moderator->id, 'actor_id' => $admin->id]);

        $this->actingAs($admin)
            ->put($this->controlUrl("/admin/usuarios/{$moderator->id}/acceso"), ['username' => 'mod.ana'])
            ->assertSessionHasNoErrors();
        $this->assertSame('mod.ana', $moderator->fresh()->username);
        $this->assertTrue(Hash::check('clave-segura-1', $moderator->fresh()->password));
    }

    #[Test]
    public function panel_access_is_only_for_the_staff_and_usernames_are_unique(): void
    {
        $admin = $this->staffMember();
        $listener = User::factory()->create();
        $moderator = tap(User::factory()->create())->assignRole(PlatformRole::Moderator->value);
        $payload = ['password' => 'clave-segura-1', 'password_confirmation' => 'clave-segura-1'];

        $this->actingAs($admin)
            ->put($this->controlUrl("/admin/usuarios/{$listener->id}/acceso"), ['username' => 'oyente', ...$payload])
            ->assertSessionHasErrors('username');

        $this->actingAs($admin)
            ->put($this->controlUrl("/admin/usuarios/{$moderator->id}/acceso"), ['username' => 'adminradio', ...$payload])
            ->assertSessionHasErrors(['username' => 'Ese usuario ya está en uso.']);

        $this->actingAs($admin)
            ->put($this->controlUrl("/admin/usuarios/{$moderator->id}/acceso"), ['username' => 'con espacios', ...$payload])
            ->assertSessionHasErrors('username');

        $this->assertNull($listener->fresh()->username);
        $this->assertNull($moderator->fresh()->username);
    }

    #[Test]
    public function staff_without_role_management_cannot_set_panel_access(): void
    {
        $superAdmin = $this->staffMember();
        $admin = $this->staffMember(PlatformRole::Admin, 'admin2');

        $this->actingAs($admin)
            ->put($this->controlUrl("/admin/usuarios/{$superAdmin->id}/acceso"), ['username' => 'otro', 'password' => 'clave-segura-1', 'password_confirmation' => 'clave-segura-1'])
            ->assertForbidden();

        $this->assertSame('adminradio', $superAdmin->fresh()->username);
    }
}
