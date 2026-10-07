<?php

namespace Tests\Feature\Gifts;

use App\Domain\Gifts\Actions\SendGift;
use App\Domain\Gifts\Enums\GiftMessageStatus;
use App\Domain\Gifts\Events\GiftCelebrated;
use App\Domain\Gifts\Events\GiftReceived;
use App\Domain\Gifts\Support\GiftPreferences;
use App\Domain\Storage\MediaFolder;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\Gift;
use App\Models\GiftMessage;
use App\Models\GiftTransaction;
use App\Models\Station;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SendGiftTest extends TestCase
{
    use RefreshDatabase;

    private Station $station;

    private Gift $rose;

    protected function setUp(): void
    {
        parent::setUp();

        $this->station = Station::factory()->create();
        $this->rose = Gift::query()->create(['name' => 'Rosa', 'slug' => 'rosa', 'emoji' => '🌹', 'price_cents' => 100, 'animation' => 'float']);
    }

    #[Test]
    public function a_gift_debits_the_listener_and_credits_the_station_its_eighty_five_percent(): void
    {
        Event::fake([GiftReceived::class, GiftCelebrated::class]);
        $listener = $this->listenerWith(1000);

        $this->actingAs($listener)
            ->postJson($this->giftUrl(), $this->form(quantity: 3, message: '¡Saludos desde Arequipa!'))
            ->assertCreated()
            ->assertJsonPath('gift.quantity', 3)
            ->assertJsonPath('gift.total_cents', 300)
            ->assertJsonPath('balance_cents', 700);

        $gift = GiftTransaction::query()->with('message')->sole();
        $this->assertSame(300, $gift->total_cents);
        $this->assertSame(15, $gift->processor_fee_cents);
        $this->assertSame(30, $gift->platform_fee_cents);
        $this->assertSame(255, $gift->station_amount_cents);
        $this->assertSame($gift->total_cents, $gift->processor_fee_cents + $gift->platform_fee_cents + $gift->station_amount_cents);
        $this->assertSame('¡Saludos desde Arequipa!', $gift->message->body);

        $ledger = app(WalletLedger::class);
        $this->assertSame(700, $ledger->balance($listener));
        $this->assertSame(255, $ledger->balance($this->station));

        Event::assertDispatched(GiftReceived::class, fn (GiftReceived $event) => $event->broadcastOn()[0] instanceof PrivateChannel
            && $event->broadcastOn()[0]->name === 'private-studio.'.$this->station->id
            && $event->gift['message']['body'] === '¡Saludos desde Arequipa!');
        Event::assertDispatched(GiftCelebrated::class, fn (GiftCelebrated $event) => $event->broadcastOn()[0] instanceof Channel
            && $event->broadcastOn()[0]->name === 'station.'.$this->station->id
            && ! array_key_exists('total_cents', $event->celebration));
    }

    #[Test]
    public function the_same_idempotency_key_sends_the_gift_once(): void
    {
        $listener = $this->listenerWith(1000);
        $form = $this->form(quantity: 2);

        $this->actingAs($listener)->postJson($this->giftUrl(), $form)->assertCreated();
        $this->actingAs($listener)->postJson($this->giftUrl(), $form)->assertOk()->assertJsonPath('balance_cents', 800);

        $this->assertSame(1, GiftTransaction::query()->count());
        $this->assertSame(800, app(WalletLedger::class)->balance($listener));
    }

    #[Test]
    public function a_listener_without_enough_balance_is_asked_to_top_up(): void
    {
        $listener = $this->listenerWith(200);

        $this->actingAs($listener)
            ->postJson($this->giftUrl(), $this->form(quantity: 3))
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'insufficient_balance');

        $this->assertSame(0, GiftTransaction::query()->count());
        $this->assertSame(1, WalletTransaction::query()->count());
        $this->assertSame(200, app(WalletLedger::class)->balance($listener));
    }

    #[Test]
    public function inactive_gifts_suspended_stations_and_bad_quantities_are_refused(): void
    {
        $listener = $this->listenerWith(10_000);

        $this->actingAs($listener)->postJson($this->giftUrl(), $this->form(quantity: 100))->assertJsonValidationErrors('quantity');
        $this->actingAs($listener)->postJson($this->giftUrl(), $this->form(message: str_repeat('a', 281)))->assertJsonValidationErrors('message');

        $this->rose->update(['active' => false]);
        $this->actingAs($listener)->postJson($this->giftUrl(), $this->form())->assertJsonValidationErrors('gift_id');

        $this->rose->update(['active' => true]);
        $this->station->forceFill(['status' => 'suspended'])->save();
        $this->actingAs($listener)->postJson($this->giftUrl(), $this->form())->assertJsonValidationErrors('gift_id');

        $this->assertSame(0, GiftTransaction::query()->count());
        $this->assertSame(10_000, app(WalletLedger::class)->balance($listener));
    }

    #[Test]
    public function suspended_listeners_cannot_send_gifts(): void
    {
        $listener = $this->listenerWith(1000);
        $listener->forceFill(['status' => 'suspended'])->save();

        $this->expectException(ValidationException::class);

        app(SendGift::class)->handle($listener, $this->station, $this->rose, 1, (string) Str::uuid());
    }

    #[Test]
    public function a_voice_message_is_stored_privately_and_reaches_the_studio(): void
    {
        Storage::fake('local');
        Storage::fake('public');
        $listener = $this->listenerWith(1000);

        $this->actingAs($listener)
            ->post($this->giftUrl(), [
                ...$this->form(),
                'voice' => UploadedFile::fake()->create('mensaje.webm', 120, 'audio/webm'),
                'voice_duration' => 12.4,
            ], ['Accept' => 'application/json'])
            ->assertCreated();

        $message = GiftMessage::query()->sole();
        $this->assertStringStartsWith(MediaFolder::GiftMessages->value.'/'.$this->station->id.'/', $message->voice_path);
        $this->assertSame(12.4, $message->voice_duration);
        Storage::disk('local')->assertExists($message->voice_path);
        Storage::disk('public')->assertMissing($message->voice_path);
    }

    #[Test]
    public function voice_messages_longer_than_allowed_are_refused(): void
    {
        Storage::fake('local');
        $listener = $this->listenerWith(1000);

        $this->actingAs($listener)
            ->post($this->giftUrl(), [
                ...$this->form(),
                'voice' => UploadedFile::fake()->create('mensaje.webm', 120, 'audio/webm'),
                'voice_duration' => 61,
            ], ['Accept' => 'application/json'])
            ->assertJsonValidationErrors('voice_duration');

        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    #[Test]
    public function station_settings_filter_messages_and_can_turn_gifts_off(): void
    {
        $preferences = app(GiftPreferences::class);
        $preferences->updateMessages($this->station, ['accept_text' => true, 'accept_voice' => false, 'auto_hide_filtered' => true, 'blocked_words' => ['tonto']]);
        $listener = $this->listenerWith(1000);

        $this->actingAs($listener)->postJson($this->giftUrl(), $this->form(message: 'Eres un tonto'))->assertCreated();

        $message = GiftMessage::query()->sole();
        $this->assertSame('Eres un *****', $message->body);
        $this->assertSame(GiftMessageStatus::Hidden, $message->status);

        $preferences->updateGifts($this->station, ['enabled' => false, 'min_gift_cents' => 100, 'thank_you_message' => 'Gracias']);
        $this->actingAs($listener)->postJson($this->giftUrl(), $this->form())->assertJsonValidationErrors('gift_id');
    }

    #[Test]
    public function the_catalog_tells_what_the_station_accepts_and_the_balance(): void
    {
        $this->actingAs($this->listenerWith(500))
            ->getJson($this->giftUrl())
            ->assertOk()
            ->assertJsonPath('gifts.0.slug', 'rosa')
            ->assertJsonPath('balance_cents', 500)
            ->assertJsonPath('station.accepts_voice', true)
            ->assertJsonPath('limits.max_voice_seconds', 60);
    }

    #[Test]
    public function guests_cannot_send_gifts(): void
    {
        $this->postJson($this->giftUrl(), $this->form())->assertUnauthorized();
    }

    private function listenerWith(int $cents): User
    {
        $listener = User::factory()->create();
        $ledger = app(WalletLedger::class);
        $ledger->deposit($ledger->open($listener), $cents, new LedgerEntry('seed:'.$listener->id));

        return $listener;
    }

    private function giftUrl(): string
    {
        return $this->publicUrl('/radio/'.$this->station->frequency->slug.'/regalos');
    }

    /**
     * @return array<string, mixed>
     */
    private function form(int $quantity = 1, ?string $message = null): array
    {
        return [
            'gift_id' => $this->rose->id,
            'quantity' => $quantity,
            'idempotency_key' => (string) Str::uuid(),
            'message' => $message,
            'anonymous' => false,
        ];
    }
}
