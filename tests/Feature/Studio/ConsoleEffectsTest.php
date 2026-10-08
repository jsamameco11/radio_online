<?php

namespace Tests\Feature\Studio;

use App\Domain\Stations\Enums\StationRole;
use App\Domain\Studio\Actions\AddFactoryEffect;
use App\Models\AuditLog;
use App\Models\Station;
use App\Models\Track;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ConsoleEffectsTest extends TestCase
{
    use LibraryFixtures, RefreshDatabase;

    private const VERSION = '0a1b2c3d';

    private Station $station;

    private User $host;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeMedia();
        $this->station = Station::factory()->create();
        $this->host = $this->teamMember($this->station, StationRole::Host);
    }

    private function console(Station $station, string $path = ''): string
    {
        return $this->studioUrl($station, '/consola'.$path);
    }

    /** A short 16-bit mono PCM WAV like the ones the console renders. */
    private function wav(): UploadedFile
    {
        $samples = str_repeat("\x00\x00", 4410);
        $header = 'RIFF'.pack('V', 36 + strlen($samples)).'WAVEfmt '.pack('VvvVVvv', 16, 1, 1, 44100, 88200, 2, 16).'data'.pack('V', strlen($samples));

        return UploadedFile::fake()->createWithContent('aplausos.wav', $header.$samples);
    }

    /** @return array<string, mixed> */
    private function effect(array $extra = []): array
    {
        return ['id' => 'aplausos', 'version' => self::VERSION, 'title' => 'Aplausos', 'category' => 'Público', 'duration' => 4, ...$extra];
    }

    #[Test]
    public function a_factory_effect_is_stored_once_for_every_station(): void
    {
        $key = AddFactoryEffect::key('aplausos', self::VERSION);

        $this->actingAs($this->host)->postJson($this->console($this->station, '/efectos'), $this->effect())
            ->assertStatus(409)
            ->assertJsonPath('code', 'audio');

        $this->actingAs($this->host)->post($this->console($this->station, '/efectos'), $this->effect(['audio' => $this->wav()]), ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('track.title', 'Aplausos')
            ->assertJsonPath('track.kind', 'effect')
            ->assertJsonPath('pads', null);
        Storage::disk(config('filesystems.media.public'))->assertExists($key);
        $this->assertDatabaseHas(AuditLog::class, ['action' => 'console.factory_effect_stored', 'station_id' => $this->station->id]);

        $other = Station::factory()->create();
        $this->actingAs($this->teamMember($other, StationRole::Host))->postJson($this->console($other, '/efectos'), $this->effect(['pad' => true]))
            ->assertOk()
            ->assertJsonPath('message', '«Aplausos» agregado a la botonera.')
            ->assertJsonCount(1, 'pads');

        $tracks = Track::acrossStations()->where('file_path', $key)->get();
        $this->assertCount(2, $tracks);
        $this->assertEqualsCanonicalizing([$this->station->id, $other->id], $tracks->pluck('station_id')->all());
        $this->assertSame(1, AuditLog::query()->where('action', 'console.factory_effect_stored')->count());
    }

    #[Test]
    public function the_same_effect_is_reused_in_the_station_library(): void
    {
        $this->actingAs($this->host)->post($this->console($this->station, '/efectos'), $this->effect(['audio' => $this->wav()]), ['Accept' => 'application/json'])->assertOk();

        $this->actingAs($this->host)->postJson($this->console($this->station, '/efectos'), $this->effect(['pad' => true, 'version' => 'ffffffff']))
            ->assertOk()
            ->assertJsonCount(1, 'pads');
        $this->actingAs($this->host)->postJson($this->console($this->station, '/efectos'), $this->effect(['pad' => true]))
            ->assertOk()
            ->assertJsonPath('message', '«Aplausos» ya está en la botonera.')
            ->assertJsonCount(1, 'pads');

        $this->assertSame(1, Track::acrossStations()->where('station_id', $this->station->id)->count());
    }

    #[Test]
    public function deleting_a_station_effect_keeps_the_shared_file(): void
    {
        $key = AddFactoryEffect::key('aplausos', self::VERSION);
        $id = $this->actingAs($this->host)->post($this->console($this->station, '/efectos'), $this->effect(['audio' => $this->wav()]), ['Accept' => 'application/json'])
            ->assertOk()
            ->json('track.id');

        $this->actingAs($this->station->owner)->delete($this->studioUrl($this->station, '/biblioteca/'.$id))->assertRedirect();

        $this->assertNull(Track::acrossStations()->find($id));
        Storage::disk(config('filesystems.media.public'))->assertExists($key);
    }

    #[Test]
    public function only_wave_audio_becomes_a_shared_effect(): void
    {
        $this->actingAs($this->host)->post($this->console($this->station, '/efectos'), $this->effect(['audio' => UploadedFile::fake()->createWithContent('aplausos.wav', str_repeat('x', 200))]), ['Accept' => 'application/json'])
            ->assertStatus(422);
        $this->actingAs($this->host)->postJson($this->console($this->station, '/efectos'), $this->effect(['id' => '../music', 'version' => 'nothex!!']))
            ->assertJsonValidationErrors(['id', 'version']);

        Storage::disk(config('filesystems.media.public'))->assertMissing(AddFactoryEffect::key('aplausos', self::VERSION));
    }

    #[Test]
    public function a_new_station_is_offered_the_basic_bank_only_once(): void
    {
        $this->actingAs($this->host)->get($this->console($this->station))
            ->assertInertia(fn (Assert $page) => $page->where('starter', true)->has('pads', 0));

        $this->actingAs($this->host)->post($this->console($this->station, '/efectos'), $this->effect(['pad' => true, 'audio' => $this->wav()]), ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonCount(1, 'pads');
        $this->actingAs($this->host)->putJson($this->console($this->station, '/botonera'), ['tracks' => []])->assertOk()->assertJsonCount(0, 'pads');

        $this->actingAs($this->host)->get($this->console($this->station))
            ->assertInertia(fn (Assert $page) => $page->where('starter', false)->has('pads', 0));
    }

    #[Test]
    public function a_station_with_effects_of_its_own_is_not_offered_the_basic_bank(): void
    {
        $this->storedTrack($this->station, ['kind' => 'effect', 'title' => 'Mi efecto', 'duration' => 2]);

        $this->actingAs($this->host)->get($this->console($this->station))
            ->assertInertia(fn (Assert $page) => $page->where('starter', false)->has('pads', 1));
    }
}
