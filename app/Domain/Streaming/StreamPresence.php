<?php

namespace App\Domain\Streaming;

use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Domain\Streaming\Events\StreamStarted;
use App\Domain\Streaming\Events\StreamStopped;
use App\Models\Station;
use App\Models\StreamSession;
use Carbon\CarbonImmutable;

/**
 * Keeps the broadcast state a station shows to everyone (stream_status, the live transmission
 * record and the heartbeat the platform monitor watches) in line with what its engine is doing:
 * off the air, playing its programming (online) or live with a host.
 */
final class StreamPresence
{
    /** The heartbeat column is written at most this often (seconds). */
    private const HEARTBEAT_EVERY = 30;

    /**
     * @param  ?array{source: string, title: ?string, host_id: ?int}  $live  the live transmission on air, if any
     */
    public function sync(Station $station, bool $onAir, ?array $live): StreamStatus
    {
        $status = match (true) {
            $station->frequency?->status === FrequencyStatus::Maintenance => StreamStatus::Maintenance,
            ! $onAir, $station->status === StationStatus::Suspended => StreamStatus::Offline,
            $live !== null => StreamStatus::Live,
            default => StreamStatus::Online,
        };
        $previous = $station->stream_status;
        $now = CarbonImmutable::now();
        $changes = [];

        if ($status !== $previous) {
            $changes['stream_status'] = $status;
        }
        if ($status->isAudible() && ($station->last_heartbeat_at === null || $station->last_heartbeat_at->lt($now->subSeconds(self::HEARTBEAT_EVERY)))) {
            $changes['last_heartbeat_at'] = $now;
        }
        if ($status === StreamStatus::Live && $previous !== StreamStatus::Live) {
            $changes['went_live_at'] = $now;
        }
        if ($changes !== []) {
            $station->forceFill($changes)->save();
        }

        if ($status === StreamStatus::Live && $previous !== StreamStatus::Live) {
            $this->open($station, $live, $now);
        } elseif ($status !== StreamStatus::Live && $previous === StreamStatus::Live) {
            $this->close($station, $status, $now);
        }

        return $status;
    }

    /** @param  array{source: string, title: ?string, host_id: ?int}  $live */
    private function open(Station $station, array $live, CarbonImmutable $now): void
    {
        StreamSession::acrossStations()->where('station_id', $station->id)->whereNull('ended_at')->update(['ended_at' => $now]);
        StreamSession::query()->create([
            'station_id' => $station->id,
            'host_id' => $live['host_id'],
            'source' => $live['source'],
            'title' => $live['title'] !== null ? mb_substr($live['title'], 0, 160) : null,
            'started_at' => $now,
            'peak_listeners' => $station->listener_count,
        ]);

        StreamStarted::dispatch($station->id, $live['source'], $live['title'], $now->toIso8601String());
    }

    private function close(Station $station, StreamStatus $status, CarbonImmutable $now): void
    {
        $session = StreamSession::acrossStations()->where('station_id', $station->id)->whereNull('ended_at')->latest('started_at')->first();
        $session?->forceFill(['ended_at' => $now])->save();

        StreamStopped::dispatch(
            $station->id,
            $status->value,
            $session ? (int) $session->started_at->diffInSeconds($now, true) : 0,
            $session?->peak_listeners ?? 0,
        );
    }
}
