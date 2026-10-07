<?php

namespace App\Domain\Streaming\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * The live transmission of a station ended: the station keeps playing its
 * programming (status "online") or went off the air (status "offline").
 */
final class StreamStopped implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public readonly int $stationId,
        public readonly string $status,
        public readonly int $seconds,
        public readonly int $peakListeners,
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
        return 'StreamStopped';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'station_id' => $this->stationId,
            'status' => $this->status,
            'seconds' => $this->seconds,
            'peak_listeners' => $this->peakListeners,
        ];
    }
}
