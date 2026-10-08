<?php

namespace Tests\Feature\Chat;

use App\Domain\Chat\Enums\ChatAuthor;
use App\Domain\Chat\Enums\ChatSticker;
use App\Domain\Chat\Events\ChatMessagePosted;
use App\Domain\Chat\Events\ChatMessageReceived;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\StationPreferences;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\ChatMessage;
use App\Models\ChatMute;
use App\Models\Station;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ChatStickerTest extends TestCase
{
    use RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'platform.wallet.processor_fee_percent' => 5,
            'platform.wallet.platform_fee_percent' => 10,
        ]);
        $this->station = Station::factory()->live()->create();
        app(StationPreferences::class)->put($this->station, 'moderation', ['slow_mode_seconds' => 0, 'block_links' => true, 'blocked_words' => []]);
    }

    #[Test]
    public function a_listener_sends_only_a_sticker(): void
    {
        Event::fake([ChatMessagePosted::class, ChatMessageReceived::class]);

        $this->actingAs(User::factory()->create())
            ->postJson($this->chatUrl(), $this->form(sticker: 'banger'))
            ->assertCreated()
            ->assertJsonPath('message.body', '')
            ->assertJsonPath('message.sticker', ['key' => 'banger', 'label' => 'Temazo']);

        $message = ChatMessage::query()->sole();
        $this->assertSame('', $message->body);
        $this->assertSame(ChatSticker::Banger, $message->sticker);
        $this->assertSame('Sticker «Temazo»', $message->preview());

        Event::assertDispatched(ChatMessagePosted::class, fn (ChatMessagePosted $event) => $event->message['sticker']['key'] === 'banger');
        Event::assertDispatched(ChatMessageReceived::class, fn (ChatMessageReceived $event) => $event->message['sticker']['label'] === 'Temazo');
    }

    #[Test]
    public function a_sticker_goes_with_text_and_only_the_text_is_filtered(): void
    {
        app(StationPreferences::class)->put($this->station, 'moderation', ['blocked_words' => ['tonto']]);
        $listener = User::factory()->create();

        $this->actingAs($listener)
            ->postJson($this->chatUrl(), $this->form('No seas tonto, sube el volumen', 'volume-up'))
            ->assertCreated()
            ->assertJsonPath('message.body', 'No seas *****, sube el volumen')
            ->assertJsonPath('message.sticker.key', 'volume-up');

        $this->actingAs($listener)
            ->postJson($this->chatUrl(), $this->form('Visiten www.ofertas.com', 'fire'))
            ->assertJsonValidationErrors(['body' => 'Esta emisora no permite enlaces en el chat.']);

        $this->assertSame(1, ChatMessage::query()->count());
    }

    #[Test]
    public function unknown_stickers_are_rejected(): void
    {
        $this->actingAs(User::factory()->create())
            ->postJson($this->chatUrl(), $this->form(sticker: 'brand-logo'))
            ->assertJsonValidationErrors(['sticker' => 'Elige uno de los stickers disponibles.']);

        $this->assertSame(0, ChatMessage::query()->count());
    }

    #[Test]
    public function a_message_needs_text_or_a_sticker(): void
    {
        $listener = User::factory()->create();

        $this->actingAs($listener)
            ->postJson($this->chatUrl(), ['client_key' => (string) Str::uuid()])
            ->assertJsonValidationErrors(['body' => 'Escribe un mensaje o elige un sticker.']);
        $this->actingAs($listener)
            ->postJson($this->chatUrl(), $this->form('   '))
            ->assertJsonValidationErrors(['body' => 'Escribe un mensaje o elige un sticker.']);

        $this->assertSame(0, ChatMessage::query()->count());
    }

    #[Test]
    public function slow_mode_and_mutes_apply_to_stickers(): void
    {
        app(StationPreferences::class)->put($this->station, 'moderation', ['slow_mode_seconds' => 30]);
        $listener = User::factory()->create();

        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form(sticker: 'hello-booth'))->assertCreated();
        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form(sticker: 'fire'))->assertJsonValidationErrors('body');

        $muted = User::factory()->create();
        ChatMute::query()->create(['station_id' => $this->station->id, 'user_id' => $muted->id, 'until' => null]);
        $this->actingAs($muted)->postJson($this->chatUrl(), $this->form(sticker: 'fire'))->assertJsonValidationErrors('body');

        $this->assertSame(1, ChatMessage::query()->count());
    }

    #[Test]
    public function the_station_answers_with_a_sticker(): void
    {
        $this->withoutVite();
        $this->actingAs(User::factory()->create())->postJson($this->chatUrl(), $this->form(sticker: 'request-song'))->assertCreated();
        $original = ChatMessage::query()->sole();
        $host = $this->teamMember($this->station, StationRole::Host);

        $this->actingAs($host)
            ->postJson($this->studioUrl($this->station, '/chat/mensajes'), ['sticker' => 'listening', 'client_key' => (string) Str::uuid(), 'reply_to' => $original->id])
            ->assertCreated()
            ->assertJsonPath('message.author', 'station')
            ->assertJsonPath('message.body', '')
            ->assertJsonPath('message.sticker', ['key' => 'listening', 'label' => 'Te escucho'])
            ->assertJsonPath('message.reply_to.body', 'Sticker «Pide tu canción»');

        $this->assertSame(ChatSticker::Listening, ChatMessage::query()->where('author', ChatAuthor::Station->value)->sole()->sticker);

        $this->actingAs($host)
            ->postJson($this->studioUrl($this->station, '/chat/mensajes'), ['client_key' => (string) Str::uuid()])
            ->assertJsonValidationErrors(['body' => 'Escribe un mensaje o elige un sticker.']);
    }

    #[Test]
    public function the_feeds_expose_the_sticker_and_the_catalog(): void
    {
        $this->actingAs(User::factory()->create())->postJson($this->chatUrl(), $this->form('¡Feliz día!', 'happy-birthday'))->assertCreated();

        $this->getJson($this->chatUrl())
            ->assertOk()
            ->assertJsonPath('messages.0.sticker', ['key' => 'happy-birthday', 'label' => 'Feliz cumpleaños'])
            ->assertJsonCount(count(ChatSticker::cases()), 'limits.stickers')
            ->assertJsonPath('limits.stickers.0', ['key' => 'hello-booth', 'label' => 'Hola cabina', 'pack' => 'greetings', 'pack_label' => 'Saludos']);

        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->getJson($this->studioUrl($this->station, '/chat/mensajes'))
            ->assertOk()
            ->assertJsonPath('messages.0.sticker.label', 'Feliz cumpleaños')
            ->assertJsonCount(count(ChatSticker::cases()), 'limits.stickers');
    }

    #[Test]
    public function a_superchat_with_a_sticker_charges_like_any_superchat(): void
    {
        $listener = User::factory()->create();
        $ledger = app(WalletLedger::class);
        $ledger->deposit($ledger->open($listener), 1000, new LedgerEntry('seed:'.$listener->id));

        $this->actingAs($listener)
            ->postJson($this->chatUrl(), $this->form(sticker: 'applause', highlight: 500))
            ->assertCreated()
            ->assertJsonPath('message.sticker.key', 'applause')
            ->assertJsonPath('message.highlight.cents', 500)
            ->assertJsonPath('balance_cents', 500);

        $message = ChatMessage::query()->sole();
        $this->assertSame([500, 25, 50, 425], [$message->highlight_cents, $message->processor_fee_cents, $message->platform_fee_cents, $message->station_amount_cents]);
        $this->assertSame(500, $ledger->balance($listener));
        $this->assertSame(425, $ledger->balance($this->station));
        $this->assertSame(-500, WalletTransaction::query()->where('type', WalletTransactionType::HighlightPurchase->value)->sole()->amount_cents);
        $this->assertSame(425, WalletTransaction::query()->where('type', WalletTransactionType::HighlightEarning->value)->sole()->amount_cents);
    }

    private function chatUrl(): string
    {
        return $this->publicUrl('/radio/'.$this->station->frequency->slug.'/chat');
    }

    /**
     * @return array<string, mixed>
     */
    private function form(?string $body = null, ?string $sticker = null, ?int $highlight = null): array
    {
        return array_filter([
            'body' => $body,
            'sticker' => $sticker,
            'client_key' => (string) Str::uuid(),
            'highlight_cents' => $highlight,
        ], fn (mixed $value) => $value !== null);
    }
}
