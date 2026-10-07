<?php

namespace App\Domain\Chat\Events;

use App\Http\Resources\Studio\ChatMessageResource;
use App\Models\ChatMessage;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

/**
 * A message reached the chat window of the station team, with what a
 * highlight credited to the station.
 *
 * Load "user", "sender", "hider" and "replyTo.user" before dispatching.
 */
final class ChatMessageReceived implements ShouldBroadcast
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
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('studio.'.$this->stationId)];
    }

    public function broadcastAs(): string
    {
        return 'chat.received';
    }

    /**
     * @return array{message: array<string, mixed>}
     */
    public function broadcastWith(): array
    {
        return ['message' => $this->message];
    }
}
