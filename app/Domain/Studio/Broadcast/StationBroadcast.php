<?php

namespace App\Domain\Studio\Broadcast;

use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaStorage;
use App\Domain\Streaming\Events\CurrentTrackChanged;
use App\Domain\Streaming\StreamPresence;
use App\Domain\Streaming\VoiceSignal;
use App\Domain\Studio\Enums\LiveSource;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\ScheduleSlot;
use App\Models\Track;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * The broadcast of the current station: what every listener polls (state()), the live session
 * of the console and the automatic music of the gaps. See ProgramEngine for how the program is
 * computed and LiveDesk for the console's live state.
 */
final class StationBroadcast
{
    /** How long before a scheduled block the console warns about it, in ms. */
    public const ALERT_AHEAD = 15 * 60000;

    /**
     * A change of the automatic music lands on a song boundary at least this many seconds ahead:
     * listeners poll every few seconds and line up the next song before it starts.
     */
    public const SWITCH_AHEAD = 30;

    /** Song boundaries offered to place a change of the automatic music by hand. */
    public const SWITCH_POINTS = 12;

    /** «Iniciar modo automático» starts this far ahead, so every listener hears the first song from its beginning. */
    private const START_AHEAD = 3000;

    /** The public state is computed at most once per this many seconds for all listeners. */
    private const STATE_TTL = 1;

    public function __construct(
        private readonly CurrentStation $current,
        private readonly BroadcastConfig $config,
        private readonly LiveDesk $desk,
        private readonly LiveSwitch $switch,
        private readonly Timeline $timeline,
        private readonly Autopilot $autopilot,
        private readonly ProgramEngine $engine,
        private readonly Schedule $schedule,
        private readonly VoiceSignal $signal,
        private readonly StreamPresence $presence,
        private readonly MediaStorage $storage,
        private readonly PlayoutCaches $caches,
    ) {}

    /** @return array<string, mixed> */
    public function config(): array
    {
        return $this->config->all();
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    public function saveConfig(array $values): array
    {
        $config = $this->config->save($values);
        $this->caches->flush();
        Cache::forget($this->current->key('state'));

        return $config;
    }

    /* ---------------------------------------------------------------- live */

    /** The live state; a session whose console stopped beating ends here. */
    public function live(): array
    {
        $live = $this->desk->stored();
        if ($live['session'] && $this->desk->operatorGone()) {
            return $this->endLive();
        }

        return $live;
    }

    /** Opens the live session; without a title it takes the name of the live block scheduled now or about to start. */
    public function startLive(User $host, string $name, string $title = ''): array
    {
        if (! $this->config->all()['on_air']) {
            $this->saveConfig(['on_air' => true]);
        }
        $this->desk->heartbeat();
        $title = $title !== '' ? $title : ($this->scheduledLiveTitle(BroadcastClock::nowMs()) ?? '');
        $live = $this->desk->update(fn (array $live) => $live['session']
            ? ['host' => $name, 'host_id' => $host->id, 'title' => $title ?: $live['title']]
            : LiveDesk::session($name, $host->id, $title));
        $this->syncPresence();

        return $live;
    }

    public function endLive(): array
    {
        $session = $this->desk->stored()['session'];
        if ($session) {
            $this->signal->close($session);
        }
        $config = $this->config->all();
        $live = $this->desk->update(fn (array $live) => [
            'session' => null, 'host' => '', 'host_id' => null, 'title' => '', 'started_at' => null, 'mic' => false, 'bed' => false, 'muted' => false,
            ...LiveSwitch::closeOnHangUp($live, $config),
        ]);
        $this->syncPresence();

        return $live;
    }

    /** Puts the station on or off the air; off, the live session ends too. */
    public function setOnAir(bool $on): void
    {
        if (! $on) {
            $this->endLive();
        }
        $this->saveConfig(['on_air' => $on]);
        $this->syncPresence();
    }

    /** Once the live transmission is over, the scheduled audios that waited for it go on air. */
    public function settleHold(): void
    {
        $live = $this->desk->stored();
        if ($live['hold'] === null || LiveDesk::holding($live)) {
            return;
        }
        $since = null;
        $this->desk->update(function (array $live) use (&$since) {
            if ($live['hold'] === null || LiveDesk::holding($live)) {
                return [];
            }
            $since = (int) $live['hold'];

            return ['hold' => null];
        });
        if ($since !== null) {
            $this->schedule->releaseHeld($since, BroadcastClock::nowMs());
        }
    }

    /**
     * Blocks of the main program the console warns about: those starting within ALERT_AHEAD and
     * the audios waiting for the live transmission to end (`held`).
     *
     * @return list<array<string, mixed>>
     */
    public function upcoming(int $now): array
    {
        $hold = $this->desk->stored()['hold'];

        return ScheduleSlot::query()->with(['track', 'playlist'])->where('layer', ScheduleSlot::MAIN)
            ->where('starts_at', '>=', BroadcastClock::utc($hold ?? $now))
            ->where('starts_at', '<=', BroadcastClock::utc($now + self::ALERT_AHEAD))
            ->orderBy('starts_at')->get()
            ->map(function (ScheduleSlot $slot) use ($hold, $now) {
                $held = $hold !== null && ProgramEngine::waits($slot, $hold);
                if ($slot->starts_at->getTimestampMs() <= $now && ! $held) {
                    return null;
                }

                return [...$this->schedule->payload($slot), 'held' => $held];
            })
            ->filter()->values()->all();
    }

    /** Title of the live block on the program now, or of the next one starting within ALERT_AHEAD. */
    public function scheduledLiveTitle(int $now): ?string
    {
        $slot = $this->timeline->liveSlot($now) ?? ScheduleSlot::query()->where('layer', ScheduleSlot::MAIN)->where('kind', ScheduleSlot::LIVE)
            ->where('starts_at', '>', BroadcastClock::utc($now))
            ->where('starts_at', '<=', BroadcastClock::utc($now + self::ALERT_AHEAD))
            ->orderBy('starts_at')->first();

        return $slot?->title ?: null;
    }

    /** Whether scheduled audios wait now for the live transmission to end. */
    public function holding(): bool
    {
        return LiveDesk::holding($this->live());
    }

    /* ------------------------------------------------------ automatic music */

    /**
     * Changes the automatic music of the gaps without cutting a song, and the last song of the old
     * source fades into the new one. It lands where the song on air ends (when it ends within
     * SWITCH_AHEAD seconds, the next one plays to its end as well), or at $at: one of the
     * boundaries of switchPoints(), chosen by the operator. With $immediately it is at once.
     *
     * @return int when the new source starts (UTC ms)
     */
    public function switchAutopilot(?string $playlist, bool $shuffle, bool $immediately = false, ?int $at = null): int
    {
        $config = $this->config->all();
        $now = BroadcastClock::nowMs();
        $playing = $this->onAir($config, $now);
        $immediately = $immediately || $this->finished($config, $now);
        [$since, $boundary] = match (true) {
            $immediately => [$now, false],
            $at !== null => [$at, true],
            default => $this->switchPoint($config, $playing, $now),
        };
        $this->saveConfig([
            'auto_prev' => [...$playing, 'tail' => $boundary],
            'auto_since' => $since,
            'auto_playlist' => $playlist,
            'auto_shuffle' => $playlist === null || $shuffle,
            'auto_start' => null,
            'auto_until' => null,
        ]);
        $this->limitToOneCycle();

        return $since;
    }

    /**
     * «Repetir»: on, the source starts over when its last song ends; off, the cycle sounding now is
     * the last one and the radio falls silent when it ends. Turning it back on after that silence
     * starts the source again from its first song.
     */
    public function setRepeat(bool $repeat): void
    {
        $config = $this->config->all();
        if ($repeat && $config['autofill'] && $this->finished($config, BroadcastClock::nowMs())) {
            $this->startAutopilot($config['auto_playlist'], (bool) $config['auto_shuffle'], null, true);

            return;
        }
        $this->saveConfig(['auto_repeat' => $repeat, 'auto_until' => null]);
        $this->limitToOneCycle();
    }

    /**
     * «Iniciar modo automático»: puts the radio on air with the automatic music on and starts the
     * source now, from the chosen song ($first; null = from the top). It starts a few seconds ahead
     * so every listener hears the song from its beginning, while the song on air fades out under
     * it; a live cut by hand ends. A scheduled audio on air keeps playing and the music follows it.
     *
     * @return int when the music starts (UTC ms)
     */
    public function startAutopilot(?string $playlist, bool $shuffle, ?string $first, ?bool $repeat = null): int
    {
        $config = $this->config->all();
        $now = BroadcastClock::nowMs();
        $since = $now + self::START_AHEAD;
        $cut = LiveSwitch::isOpen($this->desk->stored()['window'], $now);
        $sounding = $config['on_air'] && $config['autofill'] && ! $cut && ! $this->finished($config, $now);
        $this->saveConfig([
            'on_air' => true,
            'autofill' => true,
            'auto_prev' => $sounding ? [...$this->onAir($config, $now), 'tail' => false, 'fade' => true] : null,
            'auto_since' => $since,
            'auto_playlist' => $playlist,
            'auto_shuffle' => $playlist === null || $shuffle,
            'auto_start' => $first,
            'auto_repeat' => $repeat ?? $config['auto_repeat'],
            'auto_until' => null,
        ]);
        if ($cut) {
            $this->switch->resume();
        }
        $this->limitToOneCycle();
        $this->syncPresence();

        return $since;
    }

    /** @return array<string, mixed>|null the first song the automatic music plays from $since, or null when something else is on air then */
    public function firstSong(int $since): ?array
    {
        foreach ($this->engine->items($since, $since + 1000, true, 4) as $item) {
            if ($item['origin'] >= $since - 50) {
                return ProgramEngine::automatic($item) ? $item : null;
            }
        }

        return null;
    }

    /** Calls off a source change that has not started yet: what is on air keeps playing. */
    public function cancelAutopilotSwitch(): bool
    {
        $config = $this->config->all();
        $now = BroadcastClock::nowMs();
        if ($config['auto_since'] <= $now || ! is_array($config['auto_prev'])) {
            return false;
        }
        $playing = $this->onAir($config, $now);
        $this->saveConfig([
            'auto_playlist' => $playing['playlist'],
            'auto_shuffle' => $playing['shuffle'],
            'auto_start' => $playing['start'],
            'auto_since' => $playing['from'],
            'auto_prev' => null,
            'auto_until' => null,
        ]);
        $this->limitToOneCycle();

        return true;
    }

    /**
     * The song boundaries of the automatic music on air where a change of source can land, from
     * the next one at least SWITCH_AHEAD seconds ahead: when each one starts and what ends there.
     * Empty when the automatic music is not sounding in the next hours.
     *
     * @return list<array{at: int, after: ?array{title: string, artist: ?string, kind: string}}>
     */
    public function switchPoints(int $limit = self::SWITCH_POINTS): array
    {
        $config = $this->config->all();
        $now = BroadcastClock::nowMs();
        if (! $config['on_air'] || ! $config['autofill'] || $this->finished($config, $now)) {
            return [];
        }

        return $this->boundaries($config, $this->onAir($config, $now), $now, $now + self::SWITCH_AHEAD * 1000, $limit)[0];
    }

    /**
     * The automatic music of the gaps, for the console and the schedule.
     *
     * @return array<string, mixed>
     */
    public function autopilot(?array $config = null): array
    {
        $config ??= $this->config->all();
        $now = BroadcastClock::nowMs();
        $current = ProgramEngine::current($config);
        // A start by hand is not a pending change: it is heard within seconds.
        $pending = $config['auto_since'] > $now && is_array($config['auto_prev']) && empty($config['auto_prev']['fade'])
            ? ProgramEngine::source($config['auto_prev']) : null;

        return [
            'mode' => $current['playlist'] !== null ? 'playlist' : 'random',
            'playlist' => $current['playlist'],
            'shuffle' => $current['shuffle'],
            'start' => $current['start'],
            'label' => $this->autopilot->label($current['playlist']),
            'since' => (int) $config['auto_since'],
            'pending' => $pending ? ['label' => $this->autopilot->label($pending['playlist']), 'at' => (int) $config['auto_since']] : null,
            'paused' => ! $config['autofill'],
            'repeat' => (bool) $config['auto_repeat'],
            'until' => $config['auto_repeat'] || $config['auto_until'] === null ? null : (int) $config['auto_until'],
            'finished' => $this->finished($config, $now),
            'level' => $this->autopilot->resolve($current['playlist'], $current['shuffle'], ProgramEngine::crossfadeMs($config))['level'],
            'broken' => Track::query()->where('active', true)->whereNotNull('file_problem')->count(),
        ];
    }

    /** @return Collection<int, Track> tracks of the pad bank, in the order the operator chose (effects and jingles until the bank is first saved) */
    public function pads(): Collection
    {
        $ids = $this->config->all()['pads'];
        if (! is_array($ids)) {
            return Track::query()->where('active', true)->whereIn('kind', [TrackKind::Effect->value, TrackKind::Jingle->value])
                ->orderByRaw('case when kind = ? then 0 else 1 end', [TrackKind::Effect->value])->orderBy('title')->limit(12)->get();
        }
        $tracks = Track::query()->whereIn('id', $ids)->where('active', true)->get()->keyBy('id');

        return collect($ids)->map(fn (string $id) => $tracks->get($id))->filter()->values();
    }

    /* --------------------------------------------------------------- state */

    /**
     * What every listener polls: the program from now on, the layers on top, the live state and
     * the mix. Computed once per second for everybody; `now` is always the server clock.
     *
     * @return array<string, mixed>
     */
    public function state(): array
    {
        $state = Cache::remember($this->current->key('state'), self::STATE_TTL, fn () => $this->compute());

        return [...$state, 'now' => BroadcastClock::nowMs()];
    }

    /**
     * What the console polls: the public state plus what only the team sees.
     *
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        $radio = $this->state();
        $live = $this->live();

        return [
            'radio' => $radio,
            'live' => $live,
            'voice' => $this->signal->connected($live['session']),
            'config' => $this->config->all(),
            'autopilot' => $this->autopilot(),
            'upcoming' => $this->upcoming($radio['now']),
        ];
    }

    /** @return list<array<string, mixed>> ICE servers listeners and the console connect through */
    public static function iceServers(): array
    {
        $servers = [['urls' => config('platform.streaming.stun_urls')]];
        if (config('platform.streaming.turn_url')) {
            $servers[] = [
                'urls' => config('platform.streaming.turn_url'),
                'username' => (string) config('platform.streaming.turn_username'),
                'credential' => (string) config('platform.streaming.turn_credential'),
            ];
        }

        return $servers;
    }

    /** Brings the station's public broadcast state (on air, live, heartbeat) in line with the engine. */
    public function syncPresence(): void
    {
        $config = $this->config->all();
        $live = $this->desk->stored();
        $now = BroadcastClock::nowMs();
        $onAir = $config['on_air'] && $this->available();
        $window = $onAir && LiveSwitch::isOpen($live['window'], $now) ? $live['window'] : null;
        $external = $window && $config['live_source'] === LiveSource::External->value && $config['live_url'] !== '';
        $this->presence->sync($this->current->get(), $onAir, match (true) {
            ! $onAir => null,
            $live['session'] !== null => ['source' => LiveSource::Console->value, 'title' => $live['title'] ?: null, 'host_id' => $live['host_id']],
            $external => ['source' => LiveSource::External->value, 'title' => ($window['title'] ?? '') ?: null, 'host_id' => null],
            default => null,
        });
    }

    /** @return array<string, mixed> */
    private function compute(): array
    {
        $station = $this->current->get();
        $config = $this->config->all();
        $this->live();
        $this->settleHold();
        $now = BroadcastClock::nowMs();
        $onAir = $config['on_air'] && $this->available();
        [$previous, $queue, $recent] = $onAir ? $this->engine->program($now) : [null, [], []];
        $live = $this->desk->stored();
        $window = $onAir && LiveSwitch::isOpen($live['window'], $now) ? $live['window'] : null;
        $external = $window && $config['live_source'] === LiveSource::External->value && $config['live_url'] !== '';
        $next = $onAir ? $this->timeline->nextShow($now) : null;
        $liveOn = $onAir && ($live['session'] !== null || $external);
        $title = $live['title'] ?: (string) ($window['title'] ?? '');
        $this->syncPresence();

        $state = [
            'station' => ['id' => $station->id, 'name' => $station->name, 'frequency' => $station->frequency?->label],
            'show_titles' => (bool) $config['show_titles'],
            'on_air' => $onAir,
            'stream' => $config['stream_url'] ?: null,
            'previous' => $previous ? $this->present($previous) : null,
            'queue' => array_map(fn (array $item) => $this->present($item), $queue),
            'recent' => array_map(fn (array $item) => $this->present($item), $recent),
            // Healthy songs of the source the player falls back on when a file fails or the server stops
            // answering (none when silence is intended, also when the source plays only once).
            'fallback' => $onAir && $config['autofill'] && $config['auto_repeat']
                ? array_map(fn (array $song) => [...$song, 'src' => $this->storage->url($song['src'])], $this->autopilot->reserve($now, $this->onAir($config, $now)['playlist']))
                : [],
            'layers' => $onAir ? array_map(fn (array $layer) => [...$layer, 'src' => $this->storage->url($layer['src'])], $this->engine->layers($live, $now)) : [],
            'next_show' => $next ? ['title' => $next->title, 'kind' => $next->kind, 'start' => $next->starts_at->getTimestampMs()] : null,
            'live' => [
                'on' => $liveOn,
                'session' => $onAir ? $live['session'] : null,
                'title' => $title,
                'host' => $live['host'] ?: null,
                'mic' => $onAir && $live['session'] !== null && $live['mic'],
                'started_at' => $live['started_at'],
                'rev' => $live['rev'],
                'mode' => $config['live_mode'],
                'source' => $config['live_source'],
                'cut' => $window !== null,
                'window' => $window,
                'url' => $external ? $config['live_url'] : null,
            ],
            'mix' => LiveDesk::mix($live, $config),
            'listeners' => $station->listener_count,
            'ice' => self::iceServers(),
        ];
        $this->announce($state, $now);

        return $state;
    }

    /** Tells everyone when what sounds changes (see CurrentTrackChanged). */
    private function announce(array $state, int $now): void
    {
        $playing = self::nowPlaying($state, $now);
        $key = $playing ? $playing['kind'].'|'.$playing['title'].'|'.$playing['started_at'] : '';
        $stored = $this->current->key('now_playing');
        if (Cache::get($stored, '') === $key) {
            return;
        }
        Cache::forever($stored, $key);
        CurrentTrackChanged::dispatch($state['station']['id'], $playing);
    }

    /**
     * What sounds now in the shape every listener shows (see resources/js/types/radio.ts).
     *
     * @return array{kind: string, title: string, artist: ?string, cover_url: ?string, started_at: string, duration: int}|null
     */
    public static function nowPlaying(array $state, int $now): ?array
    {
        if (! $state['on_air']) {
            return null;
        }
        if ($state['live']['on']) {
            return [
                'kind' => ScheduleSlot::LIVE,
                'title' => $state['live']['title'] ?: 'En vivo',
                'artist' => $state['live']['host'],
                'cover_url' => null,
                'started_at' => CarbonImmutable::createFromTimestampMs((int) ($state['live']['started_at'] ?? $now))->toIso8601String(),
                'duration' => 0,
            ];
        }
        $item = collect($state['queue'])->first(fn (array $item) => $item['start'] <= $now && $now < $item['end']);
        if ($item === null) {
            return null;
        }
        $hidden = ! $state['show_titles'] && $item['kind'] === TrackKind::Song->value;

        return [
            'kind' => $item['kind'],
            'title' => $hidden ? $state['station']['name'] : $item['title'],
            'artist' => $hidden ? null : $item['artist'],
            'cover_url' => $hidden ? null : $item['cover'],
            'started_at' => CarbonImmutable::createFromTimestampMs((int) $item['origin'])->toIso8601String(),
            'duration' => (int) round(($item['end'] - $item['origin']) / 1000),
        ];
    }

    /** Whether the station may sound at all: active and its frequency not in maintenance. */
    private function available(): bool
    {
        $station = $this->current->get();

        return $station->status === StationStatus::Active && $station->frequency?->status !== FrequencyStatus::Maintenance;
    }

    /** @return array<string, mixed> an item of the program with browser-ready addresses */
    private function present(array $item): array
    {
        return [...$item, 'src' => $this->storage->url($item['src']), 'cover' => $this->storage->url($item['cover'] ?? null)];
    }

    /** Whether the single cycle of a source without repeat already played to its end (its last song included). */
    private function finished(array $config, int $now): bool
    {
        return ! $config['auto_repeat'] && $config['auto_until'] !== null
            && $now >= (int) $config['auto_until'] + ProgramEngine::crossfadeMs($config);
    }

    /** With repeat off, the music stops at the end of the cycle of the current source (see cycleEnd()). */
    private function limitToOneCycle(): void
    {
        $config = $this->config->all();
        if (! $config['auto_repeat']) {
            $this->saveConfig(['auto_until' => $this->cycleEnd($config, BroadcastClock::nowMs())]);
        }
    }

    /**
     * When the cycle of the current source that sounds now (or sounds next) ends: every song of it
     * once from where its music started. Null when the source has no song.
     */
    private function cycleEnd(array $config, int $now): ?int
    {
        $current = ProgramEngine::current($config);
        $total = array_sum(array_column($this->autopilot->resolve($current['playlist'], $current['shuffle'], ProgramEngine::crossfadeMs($config))['songs'], 'step'));
        if ($total <= 0) {
            return null;
        }
        $since = (int) $config['auto_since'];
        $at = max($now, $since);
        foreach ($this->engine->items($at, $at + 6 * 3600000, true, 200, [...$config, 'auto_until' => null]) as $item) {
            if (ProgramEngine::automatic($item) && $item['origin'] >= $since) {
                $at = $item['origin'];
                break;
            }
        }
        $live = $this->desk->stored();
        $anchor = max($this->engine->anchorBefore($at, $this->switch->window($config, $live, $now), $live['hold']), $since);

        return $anchor + (intdiv(max(0, $at - $anchor), $total) + 1) * $total;
    }

    /**
     * The source of the automatic music on air at $now and since when it plays.
     *
     * @return array{playlist: ?string, shuffle: bool, start: ?string, from: int}
     */
    private function onAir(array $config, int $now): array
    {
        if ($config['auto_since'] > $now && is_array($config['auto_prev'])) {
            return ProgramEngine::source($config['auto_prev']);
        }

        return ProgramEngine::current($config);
    }

    /**
     * Where a change of source lands by default: when the song on air ends (the first automatic
     * song that starts at least SWITCH_AHEAD seconds from now, where the song before fades into
     * the new source).
     *
     * @return array{0: int, 1: bool} the time and whether it is a song boundary
     */
    private function switchPoint(array $config, array $playing, int $now): array
    {
        $due = $now + self::SWITCH_AHEAD * 1000;
        [$points, $sounding, $lastEnd] = $this->boundaries($config, $playing, $now, $due, 1);
        if ($points) {
            return [$points[0]['at'], true];
        }

        // No song boundary ahead: the program takes over, so the change waits for the end of this music.
        return [$sounding ? max($due, $lastEnd) : $now, false];
    }

    /**
     * Song boundaries of the automatic music of $playing from $due on (up to $limit), whether that
     * music sounds now, and when the last of it before the first boundary ends.
     *
     * @return array{0: list<array{at: int, after: ?array{title: string, artist: ?string, kind: string}}>, 1: bool, 2: int}
     */
    private function boundaries(array $config, array $playing, int $now, int $due, int $limit): array
    {
        $items = $this->engine->items($now, $due + 3 * 3600000, true, 200, [
            ...$config,
            'auto_playlist' => $playing['playlist'],
            'auto_shuffle' => $playing['shuffle'],
            'auto_start' => $playing['start'],
            'auto_since' => $playing['from'],
            'auto_prev' => null,
        ]);

        $points = [];
        $sounding = false;
        $lastEnd = $now;
        $before = null;
        foreach ($items as $item) {
            $automatic = ProgramEngine::automatic($item);
            if ($automatic && $item['origin'] >= $due) {
                $points[] = [
                    'at' => (int) $item['origin'],
                    'after' => $before ? ['title' => (string) $before['title'], 'artist' => $before['artist'] ?? null, 'kind' => (string) $before['kind']] : null,
                ];
                if (count($points) >= $limit) {
                    break;
                }
            } elseif ($automatic && ! $points) {
                $sounding = $sounding || $item['start'] <= $now;
                $lastEnd = max($lastEnd, $item['end']);
            }
            $before = $item;
        }

        return [$points, $sounding, $lastEnd];
    }
}
