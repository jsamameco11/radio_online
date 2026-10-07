<?php

namespace App\Domain\Streaming\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Some frequencies of the dial changed (status, station, audience): the
 * platform monitor replaces those cells. Built by
 * App\Domain\Streaming\Monitor\StreamMonitor::publish().
 */
final class MonitorUpdated implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable;

    /**
     * @param  list<array<string, mixed>>  $cells
     */
    public function __construct(public readonly array $cells) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('control.monitor');
    }

    public function broadcastAs(): string
    {
        return 'MonitorUpdated';
    }

    /**
     * @return array{cells: list<array<string, mixed>>}
     */
    public function broadcastWith(): array
    {
        return ['cells' => $this->cells];
    }
}
