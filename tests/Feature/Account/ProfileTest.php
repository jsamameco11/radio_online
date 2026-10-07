<?php

namespace Tests\Feature\Account;

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    #[Test]
    public function the_profile_page_opens_on_both_hosts(): void
    {
        $user = User::factory()->create(['country' => 'PE']);

        foreach ([$this->publicUrl('/cuenta/perfil'), $this->controlUrl('/cuenta/perfil')] as $url) {
            $this->actingAs($user)
                ->get($url)
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Account/Profile')
                    ->where('profile.email', $user->email)
                    ->where('profile.country', 'PE')
                    ->has('resendVerificationUrl'));
        }
    }

    #[Test]
    public function guests_are_sent_to_sign_in(): void
    {
        $this->get($this->publicUrl('/cuenta/perfil'))->assertRedirect($this->publicUrl('/ingresar'));
        $this->get($this->controlUrl('/cuenta/seguridad'))->assertRedirect($this->controlUrl('/ingresar'));
    }

    #[Test]
    public function listeners_update_their_name_and_country(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patch($this->publicUrl('/cuenta/perfil'), ['name' => 'Ana Torres', 'email' => $user->email, 'country' => 'cl'])
            ->assertRedirect()
            ->assertSessionHas('success');

        $user->refresh();
        $this->assertSame('Ana Torres', $user->name);
        $this->assertSame('CL', $user->country);
        $this->assertNotNull($user->email_verified_at);
    }

    #[Test]
    public function changing_the_email_asks_to_verify_it_again(): void
    {
        Notification::fake();
        $user = User::factory()->create();

        $this->actingAs($user)->patch($this->publicUrl('/cuenta/perfil'), ['name' => $user->name, 'email' => 'Nueva@Correo.com']);

        $user->refresh();
        $this->assertSame('nueva@correo.com', $user->email);
        $this->assertNull($user->email_verified_at);
        Notification::assertSentTo($user, VerifyEmail::class);
    }

    #[Test]
    public function the_email_must_be_unique_and_the_country_valid(): void
    {
        $taken = User::factory()->create();
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patch($this->publicUrl('/cuenta/perfil'), ['name' => $user->name, 'email' => $taken->email, 'country' => 'Peru'])
            ->assertSessionHasErrors(['email', 'country']);
    }

    #[Test]
    public function listeners_upload_and_remove_their_avatar(): void
    {
        $disk = Storage::fake((string) config('filesystems.media.public'));
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post($this->publicUrl('/cuenta/perfil/foto'), ['avatar' => UploadedFile::fake()->image('yo.png', 200, 200)])
            ->assertRedirect()
            ->assertSessionHas('success');

        $path = $user->fresh()->avatar_path;
        $this->assertNotNull($path);
        $disk->assertExists($path);

        $this->actingAs($user)->delete($this->publicUrl('/cuenta/perfil/foto'))->assertRedirect();

        $this->assertNull($user->fresh()->avatar_path);
        $disk->assertMissing($path);
    }

    #[Test]
    public function avatars_must_be_images(): void
    {
        Storage::fake((string) config('filesystems.media.public'));
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post($this->publicUrl('/cuenta/perfil/foto'), ['avatar' => UploadedFile::fake()->create('notas.pdf', 50, 'application/pdf')])
            ->assertSessionHasErrors('avatar');

        $this->assertNull($user->fresh()->avatar_path);
    }
}
