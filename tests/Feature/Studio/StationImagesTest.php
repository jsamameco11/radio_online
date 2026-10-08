<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Models\Station;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StationImagesTest extends TestCase
{
    use RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        Storage::fake((string) config('filesystems.media.public'));
        $this->station = Station::factory()->create(['logo_path' => null, 'cover_path' => null]);
    }

    #[Test]
    public function the_owner_uploads_a_cover_photo_that_tops_the_station_page(): void
    {
        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/perfil/imagenes/cover'), ['image' => UploadedFile::fake()->image('portada.jpg', 1600, 530)])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', 'Actualizamos la foto de portada.');

        $cover = $this->station->fresh()->cover_path;
        $this->assertNotNull($cover);
        Storage::disk((string) config('filesystems.media.public'))->assertExists($cover);

        $this->get($this->publicUrl('/radio/'.$this->station->frequency->slug))
            ->assertInertia(fn (Assert $page) => $page->where('station.cover_url', fn (?string $url) => $url !== null && str_contains($url, $cover)));
    }

    #[Test]
    public function the_cover_photo_has_to_be_wide(): void
    {
        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/perfil/imagenes/cover'), ['image' => UploadedFile::fake()->image('cuadrada.jpg', 800, 800)])
            ->assertSessionHasErrors(['image' => 'La foto de portada debe ser horizontal y medir al menos 960 × 320 píxeles.']);

        $this->actingAs($this->station->owner)
            ->post($this->studioUrl($this->station, '/perfil/imagenes/logo'), ['image' => UploadedFile::fake()->image('logo.png', 400, 400)])
            ->assertSessionHasNoErrors();

        $this->assertNull($this->station->fresh()->cover_path);
        $this->assertNotNull($this->station->fresh()->logo_path);
    }

    #[Test]
    public function only_the_logo_and_the_cover_photo_can_be_uploaded(): void
    {
        foreach (['avatar', 'banner'] as $slot) {
            $this->actingAs($this->station->owner)
                ->post($this->studioUrl($this->station, "/perfil/imagenes/{$slot}"), ['image' => UploadedFile::fake()->image('foto.png', 400, 400)])
                ->assertNotFound();
        }
    }

    #[Test]
    public function only_who_edits_the_profile_gets_a_shortcut_to_change_the_cover_photo(): void
    {
        $page = $this->publicUrl('/radio/'.$this->station->frequency->slug);

        $this->actingAs($this->station->owner)
            ->get($page)
            ->assertInertia(fn (Assert $page) => $page->where('coverEditUrl', '/ir/consola?'.http_build_query(['a' => '/'.$this->station->frequency->slug.'/perfil#portada'])));

        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->get($page)
            ->assertInertia(fn (Assert $page) => $page->where('coverEditUrl', null)->whereNot('studioUrl', null));
    }
}
