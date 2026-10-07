<?php

namespace Tests\Feature\Chat;

use App\Domain\Chat\Enums\ChatAuthor;
use App\Domain\Chat\Enums\ChatMessageStatus;
use App\Domain\Chat\Events\ChatMessagePosted;
use App\Domain\Chat\Events\ChatMessageVisibilityChanged;
use App\Domain\Moderation\Enums\ReportReason;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\StationPreferences;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\AuditLog;
use App\Models\ChatMessage;
use App\Models\ChatMute;
use App\Models\Report;
use App\Models\Station;
use App\Models\StreamSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StudioChatTest extends TestCase
{
    use RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        config([
            'platform.wallet.processor_fee_percent' => 5,
            'platform.wallet.platform_fee_percent' => 10,
        ]);
        $this->station = Station::factory()->live()->create();
        StreamSession::query()->create(['station_id' => $this->station->id, 'source' => 'console', 'started_at' => now()->subMinutes(5)]);
    }

    #[Test]
    public function hosts_see_the_chat_and_the_summary_of_the_live_session(): void
    {
        $ana = $this->listenerWith(5000, 'Ana');
        $luis = $this->listenerWith(5000, 'Luis');
        $this->say($ana, 'Hola cabina');
        $this->say($ana, 'Para ti', 1000);
        $this->say($luis, 'Saludos', 200);
        $host = $this->teamMember($this->station, StationRole::Host);

        $earned = ChatMessage::query()->sum('station_amount_cents');

        $this->actingAs($host)
            ->get($this->studioUrl($this->station, '/chat'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Chat')
                ->has('feed.messages', 3)
                ->where('feed.open', true)
                ->where('summary.messages', 3)
                ->where('summary.writers', 2)
                ->where('summary.highlighted', 2)
                ->where('summary.earned_cents', (int) $earned)
                ->where('summary.supporters.0.name', 'Ana')
                ->missing('feed.messages.1.highlight.cents')
                ->where('feed.messages.1.highlight.credited_cents', ChatMessage::query()->where('highlight_cents', 1000)->value('station_amount_cents')));

        $this->actingAs($host)->getJson($this->studioUrl($this->station, '/chat/mensajes'))->assertOk()->assertJsonCount(3, 'messages');
    }

    #[Test]
    public function the_team_answers_as_the_station(): void
    {
        Event::fake([ChatMessagePosted::class]);
        $original = $this->say($this->listenerWith(0, 'Ana'), '¿Pueden saludar a Lima?');
        $host = $this->teamMember($this->station, StationRole::Host);

        $this->actingAs($host)
            ->postJson($this->studioUrl($this->station, '/chat/mensajes'), ['body' => '¡Saludos, Lima!', 'client_key' => (string) Str::uuid(), 'reply_to' => $original->id])
            ->assertCreated()
            ->assertJsonPath('message.author', 'station')
            ->assertJsonPath('message.reply_to.id', $original->id)
            ->assertJsonPath('message.sent_by', $host->name);

        $reply = ChatMessage::query()->where('author', ChatAuthor::Station->value)->sole();
        $this->assertNull($reply->user_id);
        $this->assertSame($host->id, $reply->sent_by);

        Event::assertDispatched(ChatMessagePosted::class, fn (ChatMessagePosted $event) => $event->message['author'] === 'station'
            && $event->message['user'] === null
            && ! str_contains((string) json_encode($event->broadcastWith()), $host->name));
    }

    #[Test]
    public function the_team_hides_and_restores_messages(): void
    {
        Event::fake([ChatMessageVisibilityChanged::class]);
        $message = $this->say($this->listenerWith(0, 'Ana'), 'Mensaje molesto');
        $host = $this->teamMember($this->station, StationRole::Host);

        $this->actingAs($host)
            ->patchJson($this->studioUrl($this->station, '/chat/mensajes/'.$message->id.'/visibilidad'), ['visible' => false])
            ->assertOk()
            ->assertJsonPath('message.status.value', 'hidden')
            ->assertJsonPath('message.hidden_by', $host->name);

        $this->assertSame(ChatMessageStatus::Hidden, $message->fresh()->status);
        $this->getJson($this->publicUrl('/radio/'.$this->station->frequency->slug.'/chat'))->assertJsonCount(0, 'messages');
        Event::assertDispatched(ChatMessageVisibilityChanged::class, fn (ChatMessageVisibilityChanged $event) => ! $event->visible && $event->message === null);
        $this->assertTrue(AuditLog::query()->where('action', 'chat.hidden')->where('actor_id', $host->id)->exists());

        $this->actingAs($host)
            ->patchJson($this->studioUrl($this->station, '/chat/mensajes/'.$message->id.'/visibilidad'), ['visible' => true])
            ->assertOk()
            ->assertJsonPath('message.status.value', 'visible');
        $this->assertTrue(AuditLog::query()->where('action', 'chat.restored')->exists());
    }

    #[Test]
    public function the_team_mutes_and_unmutes_listeners(): void
    {
        $listener = $this->listenerWith(0, 'Ana');
        $this->say($listener, 'Spam');
        $host = $this->teamMember($this->station, StationRole::Host);

        $this->actingAs($host)
            ->postJson($this->studioUrl($this->station, '/chat/silenciados'), ['user_id' => $listener->id, 'minutes' => 10])
            ->assertOk()
            ->assertJsonPath('mute.user_id', $listener->id);
        $this->assertTrue(AuditLog::query()->where('action', 'chat.muted')->exists());

        $this->actingAs($listener)
            ->postJson($this->chatUrl(), ['body' => 'Más spam', 'client_key' => (string) Str::uuid()])
            ->assertJsonValidationErrors('body');

        $this->actingAs($host)->deleteJson($this->studioUrl($this->station, '/chat/silenciados/'.$listener->id))->assertOk();
        $this->assertSame(0, ChatMute::query()->count());
        $this->actingAs($listener)->postJson($this->chatUrl(), ['body' => 'Perdón', 'client_key' => (string) Str::uuid()])->assertCreated();
    }

    #[Test]
    public function team_members_cannot_be_muted_and_only_chat_writers_can(): void
    {
        $host = $this->teamMember($this->station, StationRole::Host);
        $manager = $this->teamMember($this->station, StationRole::Manager);
        $stranger = User::factory()->create();

        $this->actingAs($host)->postJson($this->studioUrl($this->station, '/chat/silenciados'), ['user_id' => $stranger->id])->assertJsonValidationErrors('user_id');

        ChatMessage::query()->create(['station_id' => $this->station->id, 'user_id' => $manager->id, 'author' => ChatAuthor::Listener, 'body' => 'Hola']);
        $this->actingAs($host)->postJson($this->studioUrl($this->station, '/chat/silenciados'), ['user_id' => $manager->id])->assertJsonValidationErrors('user_id');

        $this->assertSame(0, ChatMute::query()->count());
    }

    #[Test]
    public function moderation_requires_console_operate(): void
    {
        $message = $this->say($this->listenerWith(0, 'Ana'), 'Hola');
        $editor = $this->teamMember($this->station, StationRole::Editor);

        $this->actingAs($editor)->get($this->studioUrl($this->station, '/chat'))->assertForbidden();
        $this->actingAs($editor)->getJson($this->studioUrl($this->station, '/chat/mensajes'))->assertForbidden();
        $this->actingAs($editor)->postJson($this->studioUrl($this->station, '/chat/mensajes'), ['body' => 'Hola', 'client_key' => (string) Str::uuid()])->assertForbidden();
        $this->actingAs($editor)->patchJson($this->studioUrl($this->station, '/chat/mensajes/'.$message->id.'/visibilidad'), ['visible' => false])->assertForbidden();
        $this->actingAs($editor)->postJson($this->studioUrl($this->station, '/chat/silenciados'), ['user_id' => $message->user_id])->assertForbidden();

        $this->assertSame(ChatMessageStatus::Visible, $message->fresh()->status);
        $this->assertSame(0, ChatMute::query()->count());
    }

    #[Test]
    public function another_station_team_cannot_moderate(): void
    {
        $message = $this->say($this->listenerWith(0, 'Ana'), 'Hola');
        $other = Station::factory()->live()->create();
        $outsider = $this->teamMember($other, StationRole::Owner);

        $this->actingAs($outsider)->patchJson($this->studioUrl($this->station, '/chat/mensajes/'.$message->id.'/visibilidad'), ['visible' => false])->assertForbidden();
        $this->actingAs($outsider)->patchJson($this->studioUrl($other, '/chat/mensajes/'.$message->id.'/visibilidad'), ['visible' => false])->assertNotFound();
        $this->actingAs($outsider)->postJson($this->studioUrl($other, '/chat/silenciados'), ['user_id' => $message->user_id])->assertJsonValidationErrors('user_id');

        $this->assertSame(ChatMessageStatus::Visible, $message->fresh()->status);
        $this->assertSame(0, ChatMute::query()->count());
    }

    #[Test]
    public function listeners_report_messages_and_much_reported_ones_hide_themselves(): void
    {
        app(StationPreferences::class)->put($this->station, 'moderation', ['auto_hide_reported' => true, 'auto_hide_threshold' => 2]);
        $author = $this->listenerWith(0, 'Ana');
        $message = $this->say($author, 'Algo ofensivo');
        $url = $this->chatUrl().'/'.$message->id.'/reportar';

        $this->actingAs($author)->postJson($url, ['reason' => ReportReason::Spam->value])->assertJsonValidationErrors('reason');

        $this->actingAs(User::factory()->create())->postJson($url, ['reason' => ReportReason::Spam->value])->assertOk();
        $this->assertSame(ChatMessageStatus::Visible, $message->fresh()->status);

        $this->actingAs(User::factory()->create())->postJson($url, ['reason' => ReportReason::Spam->value])->assertOk();
        $this->assertSame(ChatMessageStatus::Hidden, $message->fresh()->status);
        $this->assertSame(2, Report::query()->where('reportable_type', 'chat_message')->count());
    }

    private function say(User $listener, string $body, ?int $highlight = null): ChatMessage
    {
        $response = $this->actingAs($listener)->postJson($this->chatUrl(), array_filter([
            'body' => $body,
            'client_key' => (string) Str::uuid(),
            'highlight_cents' => $highlight,
        ]))->assertCreated();

        return ChatMessage::query()->findOrFail($response->json('message.id'));
    }

    private function listenerWith(int $cents, string $name): User
    {
        $listener = User::factory()->create(['name' => $name]);
        if ($cents > 0) {
            $ledger = app(WalletLedger::class);
            $ledger->deposit($ledger->open($listener), $cents, new LedgerEntry('seed:'.$listener->id));
        }

        return $listener;
    }

    private function chatUrl(): string
    {
        return $this->publicUrl('/radio/'.$this->station->frequency->slug.'/chat');
    }
}
