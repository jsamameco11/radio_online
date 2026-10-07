<?php

namespace App\Domain\Chat\Events;

use App\Http\Resources\ChatMessageResource;
use App\Models\ChatMessage;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

/**
 * A message appeared in the chat of a station: every listener on its page
 * sees it at once. Public data only (no fees, no emails).
 *
 * Load "user" and "replyTo.user" before dispatching.
 */
final class ChatMessagePosted implements ShouldBroadcast
{
    public readonly int $stationId;

    /** @var array<string, mixed> */
    public readonly array $message;

    public function __construct(ChatMessage $message)
    {
        $this->stationId = $message->station_id;
        $this->message = ChatMessageResource::make($message)->resolve();
    }

    /**
     * @return list<Channel>
     */
    public function broadcastOn(): array
    {
        return [new Channel('station.'.$this->stationId)];
    }

    public function broadcastAs(): string
    {
        return 'chat.message';
    }

    /**
     * @return array{message: array<string, mixed>}
     */
    public function broadcastWith(): array
    {
        return ['message' => $this->message];
    }
}
