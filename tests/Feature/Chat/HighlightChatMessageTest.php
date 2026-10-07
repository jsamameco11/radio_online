<?php

namespace Tests\Feature\Chat;

use App\Domain\Chat\Events\ChatMessagePosted;
use App\Domain\Chat\Events\ChatMessageReceived;
use App\Domain\Stations\Support\StationPreferences;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\ChatMessage;
use App\Models\Station;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class HighlightChatMessageTest extends TestCase
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
    }

    #[Test]
    public function a_highlight_debits_the_listener_and_credits_the_station_its_share(): void
    {
        Event::fake([ChatMessagePosted::class, ChatMessageReceived::class]);
        $listener = $this->listenerWith(1000);
        $tier = $this->tier(500);

        $this->actingAs($listener)
            ->postJson($this->chatUrl(), $this->form('¡Feliz cumpleaños, mamá!', 500))
            ->assertCreated()
            ->assertJsonPath('message.highlight.cents', 500)
            ->assertJsonPath('message.highlight.level', $tier['level'])
            ->assertJsonPath('balance_cents', 500);

        $processor = intdiv(500 * (int) config('platform.wallet.processor_fee_percent'), 100);
        $platform = intdiv(500 * (int) config('platform.wallet.platform_fee_percent'), 100);
        $station = 500 - $processor - $platform;
        $this->assertSame([25, 50, 425], [$processor, $platform, $station]);

        $message = ChatMessage::query()->sole();
        $this->assertSame(500, $message->highlight_cents);
        $this->assertSame($processor, $message->processor_fee_cents);
        $this->assertSame($platform, $message->platform_fee_cents);
        $this->assertSame($station, $message->station_amount_cents);
        $this->assertEqualsWithDelta(now()->addSeconds($tier['pin_seconds'])->getTimestamp(), $message->pinned_until->getTimestamp(), 2);

        $ledger = app(WalletLedger::class);
        $this->assertSame(500, $ledger->balance($listener));
        $this->assertSame($station, $ledger->balance($this->station));

        $debit = WalletTransaction::query()->findOrFail($message->debit_transaction_id);
        $credit = WalletTransaction::query()->findOrFail($message->credit_transaction_id);
        $this->assertSame(WalletTransactionType::HighlightPurchase, $debit->type);
        $this->assertSame(-500, $debit->amount_cents);
        $this->assertSame(WalletTransactionType::HighlightEarning, $credit->type);
        $this->assertSame($station, $credit->amount_cents);

        Event::assertDispatched(ChatMessagePosted::class, fn (ChatMessagePosted $event) => $this->withoutFees($event->broadcastWith()));
        Event::assertDispatched(ChatMessageReceived::class, fn (ChatMessageReceived $event) => $this->withoutFees($event->broadcastWith())
            && $event->message['highlight']['credited_cents'] === $station
            && ! array_key_exists('cents', $event->message['highlight']));
    }

    #[Test]
    public function a_listener_without_enough_balance_is_asked_to_top_up(): void
    {
        $listener = $this->listenerWith(150);

        $this->actingAs($listener)
            ->postJson($this->chatUrl(), $this->form('Destácame', 200))
            ->assertUnprocessable()
            ->assertJsonPath('reason', 'insufficient_balance');

        $this->assertSame(0, ChatMessage::query()->count());
        $this->assertSame(150, app(WalletLedger::class)->balance($listener));
    }

    #[Test]
    public function only_the_configured_tiers_can_be_paid(): void
    {
        $listener = $this->listenerWith(10_000);

        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Destácame', 333))->assertJsonValidationErrors('highlight_cents');
        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Destácame', 1))->assertJsonValidationErrors('highlight_cents');

        $this->assertSame(0, ChatMessage::query()->count());
        $this->assertSame(10_000, app(WalletLedger::class)->balance($listener));
    }

    #[Test]
    public function retrying_the_same_highlight_does_not_charge_twice(): void
    {
        $listener = $this->listenerWith(1000);
        $form = $this->form('Una sola vez', 200);

        $this->actingAs($listener)->postJson($this->chatUrl(), $form)->assertCreated();
        $this->actingAs($listener)->postJson($this->chatUrl(), $form)->assertOk()->assertJsonPath('balance_cents', 800);

        $this->assertSame(1, ChatMessage::query()->count());
        $this->assertSame(800, app(WalletLedger::class)->balance($listener));
        $this->assertSame(1, WalletTransaction::query()->where('type', WalletTransactionType::HighlightPurchase->value)->count());
    }

    #[Test]
    public function highlights_skip_slow_mode(): void
    {
        app(StationPreferences::class)->put($this->station, 'moderation', ['slow_mode_seconds' => 60]);
        $listener = $this->listenerWith(1000);

        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Gratis'))->assertCreated();
        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Otra gratis'))->assertJsonValidationErrors('body');
        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Pagado', 100))->assertCreated();

        $this->assertSame(2, ChatMessage::query()->count());
    }

    #[Test]
    public function the_chat_pins_highlights_while_their_tier_lasts(): void
    {
        $listener = $this->listenerWith(5000);
        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Arriba', 1000))->assertCreated();
        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Sin fijar', 100))->assertCreated();

        $this->getJson($this->chatUrl())->assertJsonCount(1, 'pinned')->assertJsonPath('pinned.0.body', 'Arriba');

        $this->travel($this->tier(1000)['pin_seconds'] + 1)->seconds();
        $this->getJson($this->chatUrl())->assertJsonCount(0, 'pinned')->assertJsonCount(2, 'messages');
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function withoutFees(array $payload): bool
    {
        $json = (string) json_encode($payload);

        return ! str_contains($json, 'fee') && ! str_contains($json, 'station_amount');
    }

    /**
     * @return array{cents: int, pin_seconds: int, level: int}
     */
    private function tier(int $cents): array
    {
        $tiers = collect(config('platform.chat.highlight_tiers'))->sortBy('cents')->values();
        $index = $tiers->search(fn (array $tier) => $tier['cents'] === $cents);

        return ['cents' => $cents, 'pin_seconds' => $tiers[$index]['pin_seconds'], 'level' => $index + 1];
    }

    private function listenerWith(int $cents): User
    {
        $listener = User::factory()->create();
        $ledger = app(WalletLedger::class);
        $ledger->deposit($ledger->open($listener), $cents, new LedgerEntry('seed:'.$listener->id));

        return $listener;
    }

    private function chatUrl(): string
    {
        return $this->publicUrl('/radio/'.$this->station->frequency->slug.'/chat');
    }

    /**
     * @return array<string, mixed>
     */
    private function form(string $body, ?int $highlight = null): array
    {
        return array_filter([
            'body' => $body,
            'client_key' => (string) Str::uuid(),
            'highlight_cents' => $highlight,
        ], fn (mixed $value) => $value !== null);
    }
}
