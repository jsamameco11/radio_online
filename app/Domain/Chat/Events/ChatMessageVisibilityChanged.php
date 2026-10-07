<?php

namespace App\Domain\Chat\Events;

use App\Http\Resources\ChatMessageResource;
use App\Models\ChatMessage;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

/**
 * The team hid a chat message (listeners drop it) or showed it again
 * (listeners get it back). The team's windows update its status.
 *
 * Load "user" and "replyTo.user" before dispatching.
 */
final class ChatMessageVisibilityChanged implements ShouldBroadcast
{
    public readonly int $stationId;

    public readonly string $messageId;

    public readonly bool $visible;

    /** @var array<string, mixed>|null */
    public readonly ?array $message;

    public function __construct(ChatMessage $message)
    {
        $this->stationId = $message->station_id;
        $this->messageId = $message->id;
        $this->visible = $message->isVisible();
        $this->message = $this->visible ? ChatMessageResource::make($message)->resolve() : null;
    }

    /**
     * @return list<Channel>
     */
    public function broadcastOn(): array
    {
        return [new Channel('station.'.$this->stationId), new PrivateChannel('studio.'.$this->stationId)];
    }

    public function broadcastAs(): string
    {
        return 'chat.visibility';
    }

    /**
     * @return array{id: string, visible: bool, message: array<string, mixed>|null}
     */
    public function broadcastWith(): array
    {
        return ['id' => $this->messageId, 'visible' => $this->visible, 'message' => $this->message];
    }
}
