<?php

namespace App\Domain\Gifts\Events;

use App\Models\GiftMessage;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

/** A host played a voice message: every open console marks it as heard. */
final class GiftMessagePlayed implements ShouldBroadcast
{
    /**
     * @param  array{message_id: string, gift_transaction_id: string, played_at: string, played_by: string|null}  $playback
     */
    public function __construct(
        public readonly int $stationId,
        public readonly array $playback,
    ) {}

    public static function from(GiftMessage $message, int $stationId, ?string $playedBy): self
    {
        return new self($stationId, [
            'message_id' => $message->id,
            'gift_transaction_id' => $message->gift_transaction_id,
            'played_at' => $message->played_at->toIso8601String(),
            'played_by' => $playedBy,
        ]);
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
        return 'gift.message.played';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return $this->playback;
    }
}
