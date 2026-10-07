<?php

namespace App\Domain\Studio\Broadcast;

use App\Domain\Stations\Support\CurrentStation;
use App\Models\Track;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * The live desk of the current station: the console session, its faders and the sounds fired on
 * top of the program (pads, players A–C and beds F1–F2). It lives in the cache, changes under a
 * lock and every change raises its revision, so listeners apply the newest mix only.
 */
final class LiveDesk
{
    /** Console lanes: the pad bank plays many sounds at once; each player and bed one at a time. */
    public const LANES = ['pad', 'A', 'B', 'C', 'F1', 'F2'];

    public const MAX_PADS = 16;

    /** Longest fade in, fade out or crossfade of a console layer, in seconds. */
    public const MAX_FADE = 12;

    /** Music and sounds drop to this share of their volume while the host speaks («Detectar voz»). */
    public const VOICE_DUCK = 0.25;

    /** The console sends a heartbeat every ~1.5 s; after this many seconds of silence the live session ends. */
    public const OPERATOR_TIMEOUT = 25;

    public const DEFAULTS = [
        'session' => null,
        'host' => '',
        'host_id' => null,
        'title' => '',
        'started_at' => null,
        'music' => 100,
        // Console faders of the layers: beds, players and scheduled layers (overlay) and the pad bank.
        'overlay' => 100,
        'pads' => 100,
        'muted' => false,
        'bed' => false,
        'mic' => false,
        'layers' => [],
        'window' => null,
        'skip' => null,
        // Since when scheduled audios wait for the live transmission (null when nothing is on air live).
        'hold' => null,
        'rev' => 0,
    ];

    /** Pads sounding at once; older ones are dropped first. */
    private const PADS_AT_ONCE = 8;

    /** A start the console reports is trusted only this close to the server clock (ms). */
    private const LAYER_CLOCK_SKEW = 5000;

    public function __construct(private readonly CurrentStation $current) {}

    /** @return array<string, mixed> */
    public function stored(): array
    {
        $stored = Cache::get($this->current->key('live'));

        return array_intersect_key(array_replace(self::DEFAULTS, is_array($stored) ? $stored : []), self::DEFAULTS);
    }

    /**
     * @param  callable(array<string, mixed>): array<string, mixed>  $change
     * @return array<string, mixed> the state after the change
     */
    public function update(callable $change): array
    {
        return Cache::lock($this->current->key('live.lock'), 5)->block(3, function () use ($change) {
            $live = $this->stored();
            $next = array_replace($live, $change($live));
            $next['rev'] = $live['rev'] + 1;
            if ($next['hold'] === null && self::holding($next)) {
                $next['hold'] = BroadcastClock::nowMs();
            }
            Cache::forever($this->current->key('live'), $next);
            Cache::forget($this->current->key('state'));

            return $next;
        });
    }

    /** Whether the live transmission is on: the console session is open or the music is cut for the live signal. */
    public static function holding(array $live): bool
    {
        return $live['session'] !== null || LiveSwitch::isOpen($live['window'], BroadcastClock::nowMs());
    }

    public function heartbeat(): void
    {
        Cache::put($this->current->key('operator'), CarbonImmutable::now()->getTimestamp(), 3600);
    }

    /** Whether the console of an open session stopped sending its heartbeat. */
    public function operatorGone(): bool
    {
        return (int) Cache::get($this->current->key('operator'), 0) < CarbonImmutable::now()->getTimestamp() - self::OPERATOR_TIMEOUT;
    }

    /** @return array<string, mixed> a new session, opened by $host */
    public static function session(string $host, ?int $hostId, string $title): array
    {
        return [
            'session' => Str::lower(Str::random(24)),
            'host' => $host,
            'host_id' => $hostId,
            'title' => $title,
            'started_at' => BroadcastClock::nowMs(),
            'mic' => false,
            'bed' => false,
            'muted' => false,
        ];
    }

    /**
     * Puts a library audio on air on top of the program: a pad, or one of the players or beds.
     * What the lane played stops at once, or fades out over the new fade in (a crossfade). A
     * looped layer repeats until it is stopped. The console may name the layer and the moment it
     * already started sounding there, so every listener hears it in step with the operator.
     *
     * @return array<string, mixed>
     */
    public function playLayer(Track $track, string $lane, int $volume, bool $duck, float $fadeIn = 0, float $fadeOut = 0, bool $loop = false, ?string $id = null, ?int $at = null): array
    {
        $now = BroadcastClock::nowMs();
        if ($at !== null && abs($at - $now) <= self::LAYER_CLOCK_SKEW) {
            $now = $at;
        }
        $length = (int) round($track->duration * 1000);
        $fadeIn = self::fade($fadeIn);
        $layer = [
            'id' => $id !== null && preg_match('/^[a-z0-9]{12}$/', $id) ? $id : Str::lower(Str::random(12)),
            'lane' => $lane,
            'track_id' => $track->id,
            'title' => $track->title,
            'kind' => $track->kind->value,
            'src' => $track->file_path,
            'start' => $now,
            'end' => $now + ($loop ? Timeline::MAX_BLOCK * 1000 : $length),
            'volume' => max(0, min(100, $volume)),
            'duck' => $duck,
            'fade_in' => $fadeIn,
            'fade_out' => self::fade($fadeOut),
            'loop' => $loop,
            'length' => $length,
        ];

        $this->update(function (array $live) use ($layer, $lane, $now, $fadeIn) {
            $layers = [];
            foreach (self::sounding($live['layers'], $now) as $item) {
                if ($item['id'] === $layer['id']) {
                    continue;
                }
                if ($lane === 'pad' || $item['lane'] !== $lane) {
                    $layers[] = $item;
                } elseif ($fadeIn > 0) {
                    $layers[] = self::fadeAway($item, $now, $fadeIn);
                }
            }
            if ($lane === 'pad') {
                $pads = array_keys(array_filter($layers, fn (array $item) => $item['lane'] === 'pad'));
                foreach (array_slice($pads, 0, max(0, count($pads) - self::PADS_AT_ONCE + 1)) as $key) {
                    unset($layers[$key]);
                }
            }

            return ['layers' => [...array_values($layers), $layer]];
        });

        return $layer;
    }

    /**
     * Stops console layers: one by id, every sound of a lane, or all of them.
     *
     * @return list<string> ids that stopped
     */
    public function stopLayers(?string $lane = null, ?string $id = null): array
    {
        $stopped = [];
        $this->update(function (array $live) use ($lane, $id, &$stopped) {
            $kept = [];
            foreach (self::sounding($live['layers'], BroadcastClock::nowMs()) as $layer) {
                $match = $id !== null ? $layer['id'] === $id : ($lane === null || $layer['lane'] === $lane);
                $match ? $stopped[] = $layer['id'] : $kept[] = $layer;
            }

            return ['layers' => $kept];
        });

        return $stopped;
    }

    /**
     * Fades console layers out instead of cutting them: one by id, every sound of a lane, or all of them.
     *
     * @return list<array<string, mixed>> the layers as they now end
     */
    public function fadeLayers(?string $lane, ?string $id, float $seconds): array
    {
        $faded = [];
        $seconds = max(0.5, self::fade($seconds));
        $this->update(function (array $live) use ($lane, $id, $seconds, &$faded) {
            $now = BroadcastClock::nowMs();
            $layers = [];
            foreach (self::sounding($live['layers'], $now) as $layer) {
                $match = $id !== null ? $layer['id'] === $id : ($lane === null || $layer['lane'] === $lane);
                if ($match) {
                    $layer = self::fadeAway($layer, $now, $seconds);
                    $faded[] = $layer;
                }
                $layers[] = $layer;
            }

            return ['layers' => $layers];
        });

        return $faded;
    }

    /** @return array<string, mixed>|null the layer with its new volume and ducking, or null when it no longer sounds */
    public function updateLayer(string $id, int $volume, bool $duck): ?array
    {
        $updated = null;
        $this->update(function (array $live) use ($id, $volume, $duck, &$updated) {
            $layers = self::sounding($live['layers'], BroadcastClock::nowMs());
            foreach ($layers as &$layer) {
                if ($layer['id'] === $id) {
                    $layer = [...$layer, 'volume' => max(0, min(100, $volume)), 'duck' => $duck];
                    $updated = $layer;
                }
            }

            return ['layers' => $layers];
        });

        return $updated;
    }

    /**
     * Gains every listener applies: music bus (after the console faders), layers bus (beds, players
     * and scheduled layers), pad bus, bed and duck levels, and what everything but the voice drops
     * to while the host's voice is detected.
     *
     * @return array{music: float, fx: float, pads: float, bed: float, duck: float, voice: float}
     */
    public static function mix(array $live, array $config): array
    {
        $music = $live['muted'] ? 0.0 : ($live['music'] / 100) * ($live['bed'] ? $config['bed_level'] / 100 : 1);

        return [
            'music' => round($music, 3),
            'fx' => round(($config['fx_level'] / 100) * ($live['overlay'] / 100), 3),
            'pads' => round(($config['fx_level'] / 100) * ($live['pads'] / 100), 3),
            'bed' => round($config['bed_level'] / 100, 3),
            'duck' => round($config['duck_level'] / 100, 3),
            'voice' => self::VOICE_DUCK,
        ];
    }

    /** @return list<array<string, mixed>> console layers still sounding at $now */
    public static function sounding(array $layers, int $now): array
    {
        return array_values(array_filter($layers, fn (array $layer) => $layer['end'] > $now));
    }

    private static function fadeAway(array $layer, int $now, float $seconds): array
    {
        $end = min($layer['end'], $now + (int) round($seconds * 1000));

        return [...$layer, 'end' => $end, 'fade_out' => round(($end - $now) / 1000, 1), 'fading' => true];
    }

    private static function fade(float $seconds): float
    {
        return round(max(0, min(self::MAX_FADE, $seconds)), 1);
    }
}
