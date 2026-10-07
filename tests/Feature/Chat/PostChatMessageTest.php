<?php

namespace Tests\Feature\Chat;

use App\Domain\Chat\Enums\ChatAuthor;
use App\Domain\Chat\Events\ChatMessagePosted;
use App\Domain\Chat\Events\ChatMessageReceived;
use App\Domain\Stations\Support\StationPreferences;
use App\Models\ChatMessage;
use App\Models\ChatMute;
use App\Models\Station;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PostChatMessageTest extends TestCase
{
    use RefreshDatabase;

    private Station $station;

    protected function setUp(): void
    {
        parent::setUp();

        $this->station = Station::factory()->live()->create();
        app(StationPreferences::class)->put($this->station, 'moderation', ['slow_mode_seconds' => 0, 'block_links' => true, 'blocked_words' => []]);
    }

    #[Test]
    public function a_listener_writes_while_the_station_is_live_and_everyone_sees_it(): void
    {
        Event::fake([ChatMessagePosted::class, ChatMessageReceived::class]);
        $listener = User::factory()->create(['name' => 'Ana Torres']);

        $this->actingAs($listener)
            ->postJson($this->chatUrl(), $this->form('¡Saludos desde Arequipa!'))
            ->assertCreated()
            ->assertJsonPath('message.body', '¡Saludos desde Arequipa!')
            ->assertJsonPath('message.author', 'listener')
            ->assertJsonPath('message.user.name', 'Ana Torres')
            ->assertJsonPath('message.highlight', null);

        $message = ChatMessage::query()->sole();
        $this->assertSame($this->station->id, $message->station_id);
        $this->assertSame($listener->id, $message->user_id);
        $this->assertSame(ChatAuthor::Listener, $message->author);

        Event::assertDispatched(ChatMessagePosted::class, fn (ChatMessagePosted $event) => $event->broadcastOn()[0] instanceof Channel
            && $event->broadcastOn()[0]->name === 'station.'.$this->station->id
            && $event->message['body'] === '¡Saludos desde Arequipa!'
            && ! str_contains((string) json_encode($event->broadcastWith()), $listener->email));
        Event::assertDispatched(ChatMessageReceived::class, fn (ChatMessageReceived $event) => $event->broadcastOn()[0] instanceof PrivateChannel
            && $event->broadcastOn()[0]->name === 'private-studio.'.$this->station->id);
    }

    #[Test]
    public function guests_read_the_chat_but_cannot_write(): void
    {
        ChatMessage::query()->create(['station_id' => $this->station->id, 'user_id' => User::factory()->create()->id, 'author' => ChatAuthor::Listener, 'body' => 'Hola a todos']);

        $this->getJson($this->chatUrl())
            ->assertOk()
            ->assertJsonPath('open', true)
            ->assertJsonPath('messages.0.body', 'Hola a todos')
            ->assertJsonPath('viewer.signed_in', false)
            ->assertJsonMissingPath('messages.0.user.email');

        $this->postJson($this->chatUrl(), $this->form('Hola'))->assertUnauthorized();
        $this->assertSame(1, ChatMessage::query()->count());
    }

    #[Test]
    public function unverified_accounts_cannot_write(): void
    {
        $this->actingAs(User::factory()->unverified()->create())
            ->postJson($this->chatUrl(), $this->form('Hola'))
            ->assertForbidden();

        $this->assertSame(0, ChatMessage::query()->count());
    }

    #[Test]
    public function the_chat_is_closed_when_the_station_is_not_live(): void
    {
        $this->station->forceFill(['stream_status' => 'online'])->save();

        $this->actingAs(User::factory()->create())
            ->postJson($this->chatUrl(), $this->form('¿Hay alguien?'))
            ->assertJsonValidationErrors(['body' => 'El chat se abre cuando la radio está en vivo.']);

        $this->getJson($this->chatUrl())->assertOk()->assertJsonPath('open', false)->assertJsonPath('messages', []);
    }

    #[Test]
    public function suspended_stations_have_no_chat(): void
    {
        $this->station->forceFill(['status' => 'suspended', 'suspended_at' => now()])->save();

        $this->getJson($this->chatUrl())->assertNotFound();
        $this->actingAs(User::factory()->create())->postJson($this->chatUrl(), $this->form('Hola'))->assertNotFound();
    }

    #[Test]
    public function blocked_words_are_masked_and_links_are_refused(): void
    {
        app(StationPreferences::class)->put($this->station, 'moderation', ['blocked_words' => ['tonto']]);
        $listener = User::factory()->create();

        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Eres un tonto'))->assertCreated()->assertJsonPath('message.body', 'Eres un *****');

        $this->actingAs($listener)
            ->postJson($this->chatUrl(), $this->form('Visiten www.ofertas.com'))
            ->assertJsonValidationErrors(['body' => 'Esta emisora no permite enlaces en el chat.']);
        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('mira https://spam.example/x'))->assertJsonValidationErrors('body');

        app(StationPreferences::class)->put($this->station, 'moderation', ['block_links' => false]);
        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Visiten www.ofertas.com'))->assertCreated();

        $this->assertSame(2, ChatMessage::query()->count());
    }

    #[Test]
    public function slow_mode_spaces_out_the_messages_of_each_listener(): void
    {
        app(StationPreferences::class)->put($this->station, 'moderation', ['slow_mode_seconds' => 30]);
        $listener = User::factory()->create();

        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Primero'))->assertCreated();
        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Segundo'))->assertJsonValidationErrors('body');
        $this->actingAs(User::factory()->create())->postJson($this->chatUrl(), $this->form('Otro oyente'))->assertCreated();

        $this->travel(31)->seconds();
        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Tercero'))->assertCreated();

        $this->assertSame(3, ChatMessage::query()->count());
    }

    #[Test]
    public function muted_listeners_are_told_politely(): void
    {
        $listener = User::factory()->create();
        ChatMute::query()->create(['station_id' => $this->station->id, 'user_id' => $listener->id, 'until' => now()->addMinutes(10)]);

        $this->actingAs($listener)
            ->postJson($this->chatUrl(), $this->form('Hola'))
            ->assertJsonValidationErrors('body');

        $this->travel(11)->minutes();
        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('Ya puedo'))->assertCreated();
    }

    #[Test]
    public function messages_are_validated(): void
    {
        $listener = User::factory()->create();

        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form(str_repeat('a', 201)))->assertJsonValidationErrors('body');
        $this->actingAs($listener)->postJson($this->chatUrl(), ['body' => 'Hola'])->assertJsonValidationErrors('client_key');
        $this->actingAs($listener)->postJson($this->chatUrl(), $this->form('   '))->assertJsonValidationErrors('body');

        $this->assertSame(0, ChatMessage::query()->count());
    }

    #[Test]
    public function the_same_client_key_posts_once(): void
    {
        $listener = User::factory()->create();
        $form = $this->form('Una vez');

        $this->actingAs($listener)->postJson($this->chatUrl(), $form)->assertCreated();
        $this->actingAs($listener)->postJson($this->chatUrl(), $form)->assertOk();

        $this->assertSame(1, ChatMessage::query()->count());
    }

    #[Test]
    public function the_station_page_carries_the_chat(): void
    {
        $this->withoutVite();
        ChatMessage::query()->create(['station_id' => $this->station->id, 'user_id' => User::factory()->create()->id, 'author' => ChatAuthor::Listener, 'body' => 'Buenas noches']);

        $this->actingAs(User::factory()->create())
            ->get($this->publicUrl('/radio/'.$this->station->frequency->slug))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Public/Station')
                ->where('chat.open', true)
                ->where('chat.viewer.signed_in', true)
                ->where('chat.messages.0.body', 'Buenas noches')
                ->has('chat.limits.tiers', count(config('platform.chat.highlight_tiers'))));
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
