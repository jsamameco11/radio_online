<?php

namespace App\Domain\Streaming\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * A live transmission began on a station (from the console or an external
 * encoder): listeners show it as live and the team sees who hosts it.
 */
final class StreamStarted implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public readonly int $stationId,
        public readonly string $source,
        public readonly ?string $title,
        public readonly string $startedAt,
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
        return 'StreamStarted';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'station_id' => $this->stationId,
            'source' => $this->source,
            'title' => $this->title,
            'started_at' => $this->startedAt,
        ];
    }
}
