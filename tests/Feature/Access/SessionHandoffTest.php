<?php

namespace Tests\Feature\Access;

use App\Domain\Access\Enums\UserStatus;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SessionHandoffTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function a_creator_opens_the_application_page_without_signing_in_again(): void
    {
        $station = Station::factory()->create();

        $pass = $this->leave($station->owner, $this->consoleUrl('/ir/escuchar?a=%2Fobten-tu-frecuencia'), $this->publicUrl('/acceso/'));

        $this->get($pass)->assertRedirect($this->publicUrl('/obten-tu-frecuencia'));
        $this->assertAuthenticatedAs($station->owner);
        $this->get($this->publicUrl('/obten-tu-frecuencia'))->assertOk();
    }

    #[Test]
    public function a_listener_opens_their_studio_from_the_public_site(): void
    {
        $station = Station::factory()->create();
        $path = '/'.$station->frequency->slug;

        $pass = $this->leave($station->owner, $this->publicUrl('/ir/consola?a='.urlencode($path)), $this->consoleUrl('/acceso/'));

        $this->get($pass)->assertRedirect($this->consoleUrl($path));
        $this->assertAuthenticatedAs($station->owner);
    }

    #[Test]
    public function a_pass_works_once(): void
    {
        $user = User::factory()->create();
        $pass = $this->leave($user, $this->consoleUrl('/ir/escuchar'), $this->publicUrl('/acceso/'));

        $this->get($pass)->assertRedirect(rtrim($this->publicUrl(), '/'));
        auth()->forgetGuards();
        $this->flushSession();

        $this->get($pass)->assertRedirect(rtrim($this->publicUrl(), '/'));
        $this->assertGuest();
    }

    #[Test]
    public function a_pass_only_opens_the_host_it_was_issued_for(): void
    {
        $user = User::factory()->create();
        $pass = $this->leave($user, $this->consoleUrl('/ir/escuchar'), $this->publicUrl('/acceso/'));

        $this->get(str_replace($this->publicUrl(), $this->controlUrl(), $pass))->assertRedirect(rtrim($this->controlUrl(), '/'));
        $this->assertGuest();
    }

    #[Test]
    public function a_suspended_account_is_not_carried_across(): void
    {
        $user = User::factory()->create();
        $pass = $this->leave($user, $this->consoleUrl('/ir/escuchar'), $this->publicUrl('/acceso/'));
        $user->forceFill(['status' => UserStatus::Suspended, 'suspended_at' => now()])->save();

        $this->get($pass)->assertRedirect(rtrim($this->publicUrl(), '/'));
        $this->assertGuest();
    }

    #[Test]
    public function guests_simply_go_to_the_other_site(): void
    {
        $this->get($this->consoleUrl('/ir/escuchar?a=%2Fradio%2F89-30'))->assertRedirect($this->publicUrl('/radio/89-30'));
    }

    #[Test]
    public function only_pages_of_the_destination_are_followed(): void
    {
        foreach (['https://otro-sitio.test', '//otro-sitio.test', '/\\otro-sitio.test', 'radio'] as $path) {
            $this->get($this->publicUrl('/ir/consola?a='.urlencode($path)))->assertRedirect($this->consoleUrl('/'));
        }
    }

    #[Test]
    public function the_control_panel_never_takes_a_pass(): void
    {
        $this->actingAs($this->staff())->get($this->publicUrl('/ir/control'))->assertNotFound();
    }

    /** Signs $user in where $leave answers, follows it and returns the pass, signed out again. */
    private function leave(User $user, string $leave, string $arrival): string
    {
        $location = (string) $this->actingAs($user)->get($leave)->assertRedirect()->headers->get('Location');

        $this->assertStringStartsWith($arrival, $location);
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9]{64}$/', Str::after($location, $arrival));

        auth()->forgetGuards();
        $this->flushSession();

        return $location;
    }
}
