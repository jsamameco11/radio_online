<?php

namespace App\Domain\Streaming\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * What sounds on a station changed (a new song, a program, the live show).
 * Players already know it from the program they compute; this keeps
 * station cards, the directory and the team's screens up to date.
 */
final class CurrentTrackChanged implements ShouldBroadcast
{
    use Dispatchable;

    /**
     * @param  array{kind: string, title: string, artist: ?string, cover_url: ?string, started_at: string, duration: int}|null  $nowPlaying
     */
    public function __construct(
        public readonly int $stationId,
        public readonly ?array $nowPlaying,
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
        return 'CurrentTrackChanged';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['station_id' => $this->stationId, 'now_playing' => $this->nowPlaying];
    }
}
