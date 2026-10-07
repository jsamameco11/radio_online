<?php

namespace Tests\Feature\Auth;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Platform\PlatformSettings;
use App\Models\User;
use Database\Seeders\AccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        $this->seed(AccessSeeder::class);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return [
            'name' => 'Lucía Paredes',
            'email' => 'lucia@example.com',
            'password' => 'Una-clave-segura-2026',
            'password_confirmation' => 'Una-clave-segura-2026',
            'terms' => '1',
        ];
    }

    #[Test]
    public function a_listener_signs_up_on_the_public_host(): void
    {
        $this->get($this->publicUrl('/registro'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Auth/Register')->where('open', true));

        $this->post($this->publicUrl('/registro'), $this->payload())->assertSessionHasNoErrors();

        $user = User::query()->sole();
        $this->assertAuthenticatedAs($user);
        $this->assertTrue($user->hasRole(PlatformRole::Listener->value));
    }

    #[Test]
    public function nobody_signs_up_while_registrations_are_closed(): void
    {
        app(PlatformSettings::class)->put(['registrations_open' => false]);

        $this->get($this->publicUrl('/registro'))
            ->assertInertia(fn (Assert $page) => $page->component('Auth/Register')->where('open', false));
        $this->get($this->publicUrl('/ingresar'))
            ->assertInertia(fn (Assert $page) => $page->where('canRegister', false));

        $this->post($this->publicUrl('/registro'), $this->payload())->assertSessionHasErrors('email');

        $this->assertGuest();
        $this->assertSame(0, User::query()->count());
    }

    #[Test]
    public function the_maintenance_notice_reaches_every_page(): void
    {
        $this->get($this->publicUrl('/ingresar'))->assertInertia(fn (Assert $page) => $page->where('notice', null));

        app(PlatformSettings::class)->put(['maintenance_banner' => 'Mantenimiento el domingo a las 3:00.']);

        $this->get($this->publicUrl('/ingresar'))
            ->assertInertia(fn (Assert $page) => $page->where('notice', 'Mantenimiento el domingo a las 3:00.'));
    }
}
