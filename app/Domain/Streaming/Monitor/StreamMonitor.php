<?php

namespace App\Domain\Streaming\Monitor;

use App\Domain\Platform\PlatformSettings;
use App\Domain\Storage\MediaStorage;
use App\Domain\Streaming\Enums\MonitorStatus;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Domain\Streaming\Events\MonitorUpdated;
use App\Models\Frequency;
use App\Models\Hashtag;
use App\Models\Station;
use App\Models\StreamSession;
use Illuminate\Support\Collection;

/**
 * The whole dial as the platform monitor shows it: one compact cell per
 * frequency (status, station, audience), the detail of one frequency, and
 * the broadcast that keeps every open monitor up to date.
 */
final class StreamMonitor
{
    private const STATION_COLUMNS = ['id', 'frequency_id', 'name', 'status', 'stream_status', 'listener_count', 'last_heartbeat_at'];

    public function __construct(
        private readonly PlatformSettings $settings,
        private readonly MediaStorage $storage,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function cells(): array
    {
        $stations = Station::query()->get(self::STATION_COLUMNS)->keyBy('frequency_id');

        return Frequency::query()
            ->onDial()
            ->get(['id', 'frequency', 'label', 'slug', 'status'])
            ->map(fn (Frequency $frequency) => $this->cell($frequency, $stations->get($frequency->id)))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function cell(Frequency $frequency, ?Station $station): array
    {
        return [
            'id' => $frequency->id,
            'label' => $frequency->label,
            'slug' => $frequency->slug,
            'mhz' => (float) $frequency->frequency,
            'status' => MonitorStatus::of($frequency, $station)->value,
            'station' => $station === null ? null : [
                'id' => $station->id,
                'name' => $station->name,
                'listeners' => $station->listener_count,
                'stale' => $this->isStale($station),
            ],
        ];
    }

    /**
     * Everything the detail drawer shows about one frequency.
     *
     * @return array<string, mixed>
     */
    public function detail(Frequency $frequency): array
    {
        $station = $frequency->station()->with(['frequency', 'owner', 'currentTopic.hashtags'])->first();
        $session = $station === null ? null : StreamSession::acrossStations()
            ->where('station_id', $station->id)
            ->with('host')
            ->latest('started_at')
            ->first();

        return [
            'cell' => $this->cell($frequency, $station),
            'frequency' => [
                'label' => $frequency->label,
                'slug' => $frequency->slug,
                'display' => $frequency->display(),
                'status' => $frequency->status->value,
                'status_label' => $frequency->status->label(),
                'reserved_at' => $frequency->reserved_at?->toIso8601String(),
                'activated_at' => $frequency->activated_at?->toIso8601String(),
            ],
            'station' => $station === null ? null : [
                'id' => $station->id,
                'name' => $station->name,
                'display_name' => $station->displayName(),
                'logo_url' => $this->storage->url($station->logo_path),
                'accent_color' => $station->accent_color,
                'owner' => ['id' => $station->owner->id, 'name' => $station->owner->name, 'email' => $station->owner->email],
                'status' => $station->status->value,
                'status_label' => $station->status->label(),
                'stream_status' => $station->stream_status->value,
                'stream_status_label' => $station->stream_status->label(),
                'listeners' => $station->listener_count,
                'peak_listeners' => $station->peak_listener_count,
                'followers' => $station->follower_count,
                'last_heartbeat_at' => $station->last_heartbeat_at?->toIso8601String(),
                'heartbeat_age_seconds' => $station->last_heartbeat_at === null ? null : (int) $station->last_heartbeat_at->diffInSeconds(now(), true),
                'stale' => $this->isStale($station),
                'latency_ms' => $station->latency_ms,
                'bitrate_kbps' => $station->bitrate_kbps,
                'went_live_at' => $station->went_live_at?->toIso8601String(),
                'topic' => $station->currentTopic === null ? null : [
                    'title' => $station->currentTopic->title,
                    'hashtags' => $station->currentTopic->hashtags->map(fn (Hashtag $tag) => $tag->name)->values()->all(),
                ],
            ],
            'session' => $session === null ? null : [
                'source' => $session->source,
                'title' => $session->title,
                'host' => $session->host?->name,
                'started_at' => $session->started_at->toIso8601String(),
                'ended_at' => $session->ended_at?->toIso8601String(),
                'peak_listeners' => $session->peak_listeners,
            ],
        ];
    }

    /** Sends the current cells of these frequencies to every open monitor. */
    public function publish(Frequency ...$frequencies): void
    {
        if ($frequencies === []) {
            return;
        }

        $stations = Station::query()
            ->whereIn('frequency_id', array_map(fn (Frequency $frequency) => $frequency->id, $frequencies))
            ->get(self::STATION_COLUMNS)
            ->keyBy('frequency_id');

        MonitorUpdated::dispatch(array_map(fn (Frequency $frequency) => $this->cell($frequency, $stations->get($frequency->id)), $frequencies));
    }

    /**
     * Stations that should be sending heartbeats but went quiet, and stations reporting failures.
     *
     * @return Collection<int, Station>
     */
    public function troubled(int $limit = 10): Collection
    {
        return Station::query()
            ->with('frequency')
            ->where(fn ($query) => $query
                ->where('stream_status', StreamStatus::Error->value)
                ->orWhere(fn ($quiet) => $quiet
                    ->whereIn('stream_status', [StreamStatus::Live->value, StreamStatus::Online->value, StreamStatus::Connecting->value])
                    ->where(fn ($heartbeat) => $heartbeat
                        ->whereNull('last_heartbeat_at')
                        ->orWhere('last_heartbeat_at', '<', now()->subSeconds($this->staleSeconds())))))
            ->orderByDesc('listener_count')
            ->limit($limit)
            ->get();
    }

    public function isStale(Station $station): bool
    {
        if (! in_array($station->stream_status, [StreamStatus::Live, StreamStatus::Online, StreamStatus::Connecting], true)) {
            return false;
        }

        return $station->last_heartbeat_at === null || $station->last_heartbeat_at->lt(now()->subSeconds($this->staleSeconds()));
    }

    private function staleSeconds(): int
    {
        return (int) $this->settings->get('stale_heartbeat_seconds');
    }
}
