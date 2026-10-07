<?php

namespace App\Domain\Streaming\Monitor;

use App\Models\Frequency;
use App\Models\Station;

/**
 * Model observer for frequencies and stations: when something the monitor
 * shows changes (status, broadcast state, audience, name), the affected
 * cell is broadcast. Heartbeats alone do not broadcast.
 */
final class PublishMonitorChanges
{
    private const STATION_FIELDS = ['status', 'stream_status', 'listener_count', 'name', 'frequency_id'];

    public function __construct(private readonly StreamMonitor $monitor) {}

    public function saved(Frequency|Station $model): void
    {
        if ($model instanceof Frequency) {
            if ($model->wasRecentlyCreated || $model->wasChanged('status')) {
                $this->monitor->publish($model);
            }

            return;
        }

        if ($model->wasRecentlyCreated || $model->wasChanged(self::STATION_FIELDS)) {
            $this->publishStation($model);
        }
    }

    public function deleted(Frequency|Station $model): void
    {
        if ($model instanceof Station) {
            $this->publishStation($model);
        }
    }

    private function publishStation(Station $station): void
    {
        $frequency = Frequency::query()->find($station->frequency_id);

        if ($frequency !== null) {
            $this->monitor->publish($frequency);
        }
    }
}
