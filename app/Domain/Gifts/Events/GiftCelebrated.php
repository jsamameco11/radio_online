<?php

namespace App\Domain\Gifts\Events;

use App\Models\GiftTransaction;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

/**
 * The public side of a gift: every listener of the station sees the
 * animation ("🌹 ×3 de Ana"). No amounts and no message contents.
 *
 * Load "gift" and "sender" before dispatching.
 */
final class GiftCelebrated implements ShouldBroadcast
{
    public readonly int $stationId;

    /** @var array{id: string, gift: array{name: string, emoji: string|null, animation: string|null}, quantity: int, sender_name: string|null, created_at: string} */
    public readonly array $celebration;

    public function __construct(GiftTransaction $transaction)
    {
        $this->stationId = $transaction->station_id;
        $this->celebration = [
            'id' => $transaction->id,
            'gift' => [
                'name' => $transaction->gift->name,
                'emoji' => $transaction->gift->emoji,
                'animation' => $transaction->gift->animation,
            ],
            'quantity' => $transaction->quantity,
            'sender_name' => $transaction->anonymous ? null : $transaction->sender->name,
            'created_at' => $transaction->created_at->toIso8601String(),
        ];
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
        return 'gift.celebrated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return $this->celebration;
    }
}
