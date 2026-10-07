<?php

namespace App\Domain\Discovery\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * "What is happening now" changed on a station: listeners (station.{id}) and
 * the station team (studio.{id}) update the topic and its hashtags. The topic
 * is null when the host ended it.
 */
final class CurrentTopicChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable;

    /**
     * @param  array{id: int, title: string, hashtags: list<string>, started_at: string}|null  $topic
     */
    public function __construct(
        public readonly int $stationId,
        public readonly ?array $topic,
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
        return 'CurrentTopicChanged';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['station_id' => $this->stationId, 'topic' => $this->topic];
    }
}
