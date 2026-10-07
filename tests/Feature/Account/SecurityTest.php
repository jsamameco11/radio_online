<?php

namespace Tests\Feature\Account;

use App\Domain\Access\Enums\PlatformRole;
use App\Models\User;
use Database\Seeders\AccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Fortify;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    #[Test]
    public function the_security_page_describes_the_account_protection(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get($this->publicUrl('/cuenta/seguridad'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Account/Security')
                ->where('twoFactor.enabled', false)
                ->where('twoFactor.pending', false)
                ->where('twoFactor.recovery_codes', null)
                ->where('staffNeedsTwoFactor', false)
                ->where('endpoints.two_factor', route('two-factor.enable', absolute: false))
                ->where('endpoints.password', route('user-password.update', absolute: false))
                ->has('sessions', 1)
                ->where('sessions.0.current', true));
    }

    #[Test]
    public function a_pending_setup_shows_the_qr_code_and_secret(): void
    {
        $user = User::factory()->create([
            'two_factor_secret' => encrypt('JBSWY3DPEHPK3PXP'),
            'two_factor_recovery_codes' => encrypt(json_encode(['code-one', 'code-two'])),
        ]);

        $this->actingAs($user)
            ->get($this->publicUrl('/cuenta/seguridad'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('twoFactor.pending', true)
                ->where('twoFactor.enabled', false)
                ->where('twoFactor.secret', 'JBSWY3DPEHPK3PXP')
                ->where('twoFactor.qr_svg', fn (string $svg) => str_contains($svg, '<svg')));
    }

    #[Test]
    public function recovery_codes_show_right_after_confirming_and_behind_the_password(): void
    {
        $user = User::factory()->withTwoFactor()->create();

        $this->actingAs($user)
            ->get($this->publicUrl('/cuenta/seguridad'))
            ->assertInertia(fn (Assert $page) => $page->where('twoFactor.enabled', true)->where('twoFactor.recovery_codes', null));

        $this->actingAs($user)
            ->withSession(['status' => Fortify::TWO_FACTOR_AUTHENTICATION_CONFIRMED])
            ->get($this->publicUrl('/cuenta/seguridad'))
            ->assertInertia(fn (Assert $page) => $page->where('twoFactor.recovery_codes', ['recovery-code-1', 'recovery-code-2']));

        $this->actingAs($user)
            ->get($this->publicUrl('/cuenta/seguridad/codigos'))
            ->assertRedirect();

        $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->get($this->publicUrl('/cuenta/seguridad/codigos'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('twoFactor.recovery_codes', 2));
    }

    #[Test]
    public function staff_without_two_factor_land_on_the_security_page_with_a_warning(): void
    {
        $this->seed(AccessSeeder::class);
        $staff = tap(User::factory()->create())->assignRole(PlatformRole::SuperAdmin->value);

        $this->actingAs($staff)
            ->get($this->controlUrl('/admin'))
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->actingAs($staff)
            ->get($this->controlUrl('/cuenta/seguridad'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('staffNeedsTwoFactor', true));
    }

    #[Test]
    public function signing_out_other_sessions_requires_the_password(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->delete($this->publicUrl('/cuenta/sesiones'), ['password' => 'incorrecta'])
            ->assertSessionHasErrors('password');

        $this->actingAs($user)
            ->delete($this->publicUrl('/cuenta/sesiones'), ['password' => 'password'])
            ->assertRedirect()
            ->assertSessionHas('success');
    }
}
