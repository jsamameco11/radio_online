<?php

namespace App\Domain\Streaming\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/** The number of people listening to a station changed. */
final class ListenerCountChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public readonly int $stationId,
        public readonly int $listeners,
        public readonly int $peak,
    ) {}

    /**
     * @return list<Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel("station.{$this->stationId}"),
            new PrivateChannel("studio.{$this->stationId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'ListenerCountChanged';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['station_id' => $this->stationId, 'listeners' => $this->listeners, 'peak' => $this->peak];
    }
}
