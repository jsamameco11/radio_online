<?php

namespace App\Domain\Studio\Broadcast;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Stations\Support\StationSettings;
use App\Domain\Studio\Enums\LiveMode;
use App\Domain\Studio\Enums\LiveSource;
use App\Models\Station;

/**
 * Broadcast configuration of the current station, kept in three StationSettings groups:
 *
 *  - broadcast:  on air, song titles for listeners, the live switch and the WebRTC audience.
 *  - audio:      crossfade, mix levels and the pad bank of the console.
 *  - automation: the automatic music of the gaps and the pending change of its source.
 *
 * The engine reads the three merged as one flat array ("config"); writes go back to the
 * group that owns each key. The external stream URL and the bitrate are station columns.
 */
final class BroadcastConfig
{
    public const BROADCAST = 'broadcast';

    public const AUDIO = 'audio';

    public const AUTOMATION = 'automation';

    public const GROUPS = [
        self::BROADCAST => [
            'on_air' => false,
            // Listeners see the name and artist of the song on air (off: only that music plays).
            'show_titles' => true,
            'live_mode' => LiveMode::Auto->value,
            'live_source' => LiveSource::Console->value,
            // External live signal (OBS / Icecast) listeners hear while the music is cut for it.
            'live_url' => '',
            // Listeners that may receive the live microphone at once over WebRTC.
            'max_voice' => 60,
        ],
        self::AUDIO => [
            'crossfade' => 4,
            'bed_level' => 22,
            'fx_level' => 90,
            'duck_level' => 25,
            // Track ids of the pad bank in order; null until the bank is first saved.
            'pads' => null,
        ],
        self::AUTOMATION => [
            'autofill' => true,
            // A playlist id (null = random songs), shuffled or in order. A change applies from
            // auto_since (a song boundary); before it, auto_prev played. auto_start is the song
            // the operator chose to start the music with (null = from the top).
            'auto_playlist' => null,
            'auto_shuffle' => true,
            'auto_start' => null,
            'auto_since' => 0,
            'auto_prev' => null,
            // With auto_repeat off the source plays each song once and falls silent at auto_until.
            'auto_repeat' => true,
            'auto_until' => null,
        ],
    ];

    public function __construct(
        private readonly CurrentStation $current,
        private readonly StationSettings $settings,
    ) {}

    /** @return array<string, mixed> */
    public static function defaults(): array
    {
        return array_merge(...array_values(self::GROUPS));
    }

    /** @return array<string, mixed> every key of the three groups, plus the station columns the engine needs */
    public function all(): array
    {
        $station = $this->current->get();
        $config = [];
        foreach (self::GROUPS as $group => $defaults) {
            $config += $this->settings->get($station, $group, $defaults);
        }

        return [
            ...$config,
            'stream_url' => (string) ($station->external_stream_url ?? ''),
            'bitrate_kbps' => (int) ($station->bitrate_kbps ?: 64),
        ];
    }

    /** @return array<string, mixed> one group merged over its defaults */
    public function group(string $group): array
    {
        return $this->settings->get($this->current->get(), $group, self::GROUPS[$group]);
    }

    /**
     * Stores the given keys in the group that owns each one; unknown keys are ignored.
     *
     * @param  array<string, mixed>  $values
     * @return array<string, mixed> the whole config after the change
     */
    public function save(array $values): array
    {
        $station = $this->current->get();
        foreach (self::GROUPS as $group => $defaults) {
            $part = array_intersect_key($values, $defaults);
            if ($part !== []) {
                $this->settings->put($station, $group, $part);
            }
        }

        return $this->all();
    }

    public function station(): Station
    {
        return $this->current->get();
    }
}
