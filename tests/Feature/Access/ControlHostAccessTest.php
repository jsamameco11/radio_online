<?php

namespace Tests\Feature\Access;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ControlHostAccessTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function both_hosts_answer_the_uptime_probe(): void
    {
        $this->get($this->publicUrl('/up'))->assertOk()->assertSee('OK');
        $this->get($this->controlUrl('/up'))->assertOk()->assertSee('OK');
    }

    #[Test]
    public function guests_must_sign_in_on_the_control_host(): void
    {
        $this->get($this->controlUrl('/'))->assertRedirect('/ingresar');
    }

    #[Test]
    public function listeners_are_sent_to_the_public_platform(): void
    {
        $this->actingAs(User::factory()->create())
            ->get($this->controlUrl('/'))
            ->assertRedirect($this->publicUrl('/crear-mi-radio'));
    }

    #[Test]
    public function the_control_host_does_not_offer_registration(): void
    {
        $this->get($this->controlUrl('/registro'))->assertRedirect($this->publicUrl('/registro'));
    }

    #[Test]
    public function suspended_accounts_are_signed_out(): void
    {
        $this->actingAs(User::factory()->suspended()->create())
            ->get($this->controlUrl('/'))
            ->assertRedirect('/ingresar');

        $this->assertGuest();
    }
}
