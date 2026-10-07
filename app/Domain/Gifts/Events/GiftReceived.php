<?php

namespace App\Domain\Gifts\Events;

use App\Http\Resources\GiftTransactionResource;
use App\Models\GiftTransaction;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

/**
 * A gift arrived: the station team sees it in the console inbox at once,
 * with its text or voice message ("ESCUCHAR MENSAJE").
 *
 * Load "gift", "sender" and "message" before dispatching.
 */
final class GiftReceived implements ShouldBroadcast
{
    public readonly int $stationId;

    /** @var array<string, mixed> */
    public readonly array $gift;

    public function __construct(GiftTransaction $transaction)
    {
        $this->stationId = $transaction->station_id;
        $this->gift = GiftTransactionResource::make($transaction)->resolve();
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
        return 'gift.received';
    }

    /**
     * @return array{gift: array<string, mixed>}
     */
    public function broadcastWith(): array
    {
        return ['gift' => $this->gift];
    }
}
