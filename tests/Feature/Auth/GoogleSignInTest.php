<?php

namespace Tests\Feature\Auth;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Platform\PlatformSettings;
use App\Models\User;
use Database\Seeders\AccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\InvalidStateException;
use Laravel\Socialite\Two\User as GoogleUser;
use Mockery;
use Mockery\MockInterface;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class GoogleSignInTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        $this->seed(AccessSeeder::class);
        config(['services.google.client_id' => 'client-id', 'services.google.client_secret' => 'client-secret']);
    }

    /** Socialite's Google driver, expecting the callback URL of the host under test. */
    private function provider(string $callbackUrl): GoogleProvider&MockInterface
    {
        $provider = Mockery::mock(GoogleProvider::class);
        $provider->shouldReceive('redirectUrl')->once()->with($callbackUrl)->andReturnSelf();
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        return $provider;
    }

    private function googleReturns(array $profile, string $host = 'public'): void
    {
        $profile += ['sub' => '1098765', 'name' => 'Ana Torres', 'email' => 'ana@gmail.com', 'email_verified' => true, 'picture' => null];
        $user = (new GoogleUser)->setRaw($profile)->map([
            'id' => $profile['sub'],
            'name' => $profile['name'],
            'email' => $profile['email'],
            'avatar' => $profile['picture'],
        ]);

        $callback = $host === 'public' ? $this->publicUrl('/auth/google/callback') : $this->controlUrl('/auth/google/callback');
        $this->provider($callback)->shouldReceive('user')->andReturn($user);
    }

    private function callbackUrl(string $host = 'public'): string
    {
        return $host === 'public' ? $this->publicUrl('/auth/google/callback?code=abc&state=xyz') : $this->controlUrl('/auth/google/callback?code=abc&state=xyz');
    }

    private function assertSendsToGoogle(string $startUrl, string $callbackUrl): void
    {
        $provider = $this->provider($callbackUrl);
        $provider->shouldReceive('with')->with(['prompt' => 'select_account'])->andReturnSelf();
        $provider->shouldReceive('redirect')->andReturn(redirect()->away('https://accounts.google.com/o/oauth2/auth'));

        $this->get($startUrl)->assertRedirect('https://accounts.google.com/o/oauth2/auth');
    }

    #[Test]
    public function the_public_host_sends_google_its_own_callback_url(): void
    {
        $this->assertSendsToGoogle($this->publicUrl('/auth/google'), $this->publicUrl('/auth/google/callback'));
    }

    #[Test]
    public function the_control_host_sends_google_its_own_callback_url(): void
    {
        $this->assertSendsToGoogle($this->controlUrl('/auth/google'), $this->controlUrl('/auth/google/callback'));
    }

    #[Test]
    public function a_new_listener_is_created_verified_and_signed_in(): void
    {
        $this->googleReturns(['email' => 'Ana@Gmail.com']);

        $this->get($this->callbackUrl())->assertRedirect('/');

        $user = User::query()->sole();
        $this->assertAuthenticatedAs($user);
        $this->assertSame('ana@gmail.com', $user->email);
        $this->assertSame('Ana Torres', $user->name);
        $this->assertSame('1098765', $user->google_id);
        $this->assertNull($user->getAuthPassword());
        $this->assertTrue($user->hasVerifiedEmail());
        $this->assertTrue($user->hasRole(PlatformRole::Listener->value));
        $this->assertNotNull($user->last_login_at);
    }

    #[Test]
    public function no_account_is_created_while_registrations_are_closed(): void
    {
        app(PlatformSettings::class)->put(['registrations_open' => false]);
        $existing = User::factory()->create(['email' => 'ana@gmail.com']);
        $this->googleReturns(['sub' => '555', 'email' => 'nueva@gmail.com']);

        $this->get($this->callbackUrl())
            ->assertRedirect('/ingresar')
            ->assertSessionHas('error', 'Por ahora no estamos creando cuentas nuevas. Vuelve a intentarlo más adelante.');

        $this->assertGuest();
        $this->assertSame([$existing->id], User::query()->pluck('id')->all());
    }

    #[Test]
    public function an_existing_account_with_the_same_email_is_linked(): void
    {
        $existing = User::factory()->unverified()->create(['email' => 'ana@gmail.com']);
        $this->googleReturns([]);

        $this->get($this->callbackUrl())->assertRedirect('/');

        $this->assertAuthenticatedAs($existing);
        $existing->refresh();
        $this->assertSame('1098765', $existing->google_id);
        $this->assertTrue($existing->hasVerifiedEmail());
        $this->assertSame(1, User::query()->count());
    }

    #[Test]
    public function a_linked_account_is_found_by_its_google_id_even_after_an_email_change(): void
    {
        $linked = User::factory()->create(['email' => 'ana@radio.pe', 'google_id' => '1098765']);
        $this->googleReturns(['email' => 'ana.nueva@gmail.com']);

        $this->get($this->callbackUrl())->assertRedirect('/');

        $this->assertAuthenticatedAs($linked);
        $this->assertSame('ana@radio.pe', $linked->fresh()->email);
    }

    #[Test]
    public function an_email_linked_to_another_google_account_is_refused(): void
    {
        User::factory()->create(['email' => 'ana@gmail.com', 'google_id' => 'otra-cuenta']);
        $this->googleReturns([]);

        $this->get($this->callbackUrl())->assertRedirect('/ingresar')->assertSessionHas('error');

        $this->assertGuest();
    }

    #[Test]
    public function google_accounts_without_a_verified_email_are_refused(): void
    {
        User::factory()->create(['email' => 'ana@gmail.com']);
        $this->googleReturns(['email_verified' => false]);

        $this->get($this->callbackUrl())->assertRedirect('/ingresar')->assertSessionHas('error');

        $this->assertGuest();
        $this->assertNull(User::query()->sole()->google_id);
    }

    #[Test]
    public function suspended_accounts_are_refused(): void
    {
        User::factory()->suspended()->create(['email' => 'ana@gmail.com', 'google_id' => '1098765']);
        $this->googleReturns([]);

        $this->get($this->callbackUrl())
            ->assertRedirect('/ingresar')
            ->assertSessionHas('error', 'Tu cuenta está suspendida. Escríbenos si crees que es un error.');

        $this->assertGuest();
    }

    #[Test]
    public function accounts_with_two_factor_go_through_the_challenge(): void
    {
        $staff = tap(User::factory()->withTwoFactor()->create(['email' => 'ana@gmail.com']))->assignRole(PlatformRole::Admin->value);
        $this->googleReturns([], 'control');

        $this->get($this->callbackUrl('control'))
            ->assertRedirect($this->controlUrl('/verificacion-en-dos-pasos'))
            ->assertSessionHas('login.id', $staff->id);

        $this->assertGuest();

        $this->get($this->controlUrl('/verificacion-en-dos-pasos'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Auth/TwoFactorChallenge'));
    }

    #[Test]
    public function a_cancelled_or_failed_attempt_returns_to_sign_in_with_a_message(): void
    {
        $this->get($this->publicUrl('/auth/google/callback?error=access_denied'))
            ->assertRedirect('/ingresar')
            ->assertSessionHas('error', 'Cancelaste el ingreso con Google.');

        $this->provider($this->publicUrl('/auth/google/callback'))->shouldReceive('user')->andThrow(new InvalidStateException);

        $this->get($this->callbackUrl())->assertRedirect('/ingresar')->assertSessionHas('error');
        $this->assertGuest();
    }

    #[Test]
    public function without_credentials_the_button_explains_it_is_unavailable(): void
    {
        config(['services.google.client_id' => null]);

        $this->get($this->publicUrl('/auth/google'))->assertRedirect('/ingresar')->assertSessionHas('error');
    }

    #[Test]
    public function signed_in_users_do_not_reach_google(): void
    {
        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl('/auth/google'))
            ->assertRedirect('/');
    }

    #[Test]
    public function google_only_accounts_set_a_password_from_the_security_page(): void
    {
        $user = User::factory()->create(['password' => null, 'google_id' => '1098765']);

        $this->actingAs($user)
            ->get($this->publicUrl('/cuenta/seguridad'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('signIn.has_password', false)
                ->where('signIn.google_linked', true));

        $this->actingAs($user)
            ->post($this->publicUrl('/cuenta/clave/crear'), ['password' => 'una-clave-segura', 'password_confirmation' => 'otra'])
            ->assertSessionHasErrors('password');

        $this->actingAs($user)
            ->post($this->publicUrl('/cuenta/clave/crear'), ['password' => 'una-clave-segura', 'password_confirmation' => 'una-clave-segura'])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertNotNull($user->fresh()->getAuthPassword());

        $this->actingAs($user->fresh())
            ->post($this->publicUrl('/cuenta/clave/crear'), ['password' => 'otra-clave-segura', 'password_confirmation' => 'otra-clave-segura'])
            ->assertForbidden();
    }

    #[Test]
    public function google_only_accounts_cannot_sign_in_with_an_empty_password(): void
    {
        User::factory()->create(['email' => 'ana@gmail.com', 'password' => null, 'google_id' => '1098765']);

        $this->post($this->publicUrl('/ingresar'), ['email' => 'ana@gmail.com', 'password' => ''])->assertSessionHasErrors('password');
        $this->post($this->publicUrl('/ingresar'), ['email' => 'ana@gmail.com', 'password' => 'cualquiera'])->assertSessionHasErrors('email');

        $this->assertGuest();
    }
}
