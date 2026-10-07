<?php

namespace App\Domain\Studio\Broadcast;

use App\Domain\Studio\Enums\TrackKind;
use App\Models\ScheduleSlot;
use App\Models\Track;
use Illuminate\Support\Collection;

/**
 * What the current station sounds at any moment, computed from the server clock.
 *
 * Every listener computes the same program: scheduled blocks of the main timeline play at
 * their exact time and, when it has a gap, the automatic music fills it in a deterministic
 * order (songs overlap by the crossfade), so everybody hears the same song. Automatic-music
 * blocks hold a period for one playlist; live blocks give way to the live signal only while
 * the host is connected (see LiveSwitch). On top of it sound the layers: overlay blocks of the
 * timeline and the pads and players fired from the console.
 *
 * The live transmission always wins: while the console is on air or the music is cut for the
 * live signal, scheduled audios of the main program wait instead of starting, and when the
 * transmission ends they play one after another (see Schedule::releaseHeld).
 */
final class ProgramEngine
{
    /** Kind of the items that stand for a whole period of automatic music in the schedule view. */
    public const FILL = 'fill';

    /** Scheduled overlays this far ahead travel with the state so listeners can preload them. */
    private const LAYER_LOOKAHEAD = 60000;

    /** Listeners see what sounded before the item on air: this far back, at most this many (newest first). */
    private const RECENT_WINDOW = 60 * 60000;

    private const RECENT_ITEMS = 6;

    /** 2026-01-01 00:00 in Lima: start of the music rotation when the timeline has never had a block. */
    public const ROTATION_EPOCH = 1767243600000;

    /** Shortest fade of the song on air when the automatic music is started by hand, in ms. */
    public const START_FADE = 2000;

    /** Kinds that never show among the recently played. */
    private const UNLISTED = [TrackKind::Commercial->value, TrackKind::Effect->value, TrackKind::Jingle->value];

    public function __construct(
        private readonly BroadcastConfig $config,
        private readonly LiveDesk $desk,
        private readonly LiveSwitch $switch,
        private readonly Timeline $timeline,
        private readonly Autopilot $autopilot,
    ) {}

    /**
     * Playable items of the main timeline overlapping [from, to), in order. With $expand it is
     * what sounds, song by song: live blocks give way to the music unless the live switch cut it.
     * Without it, it is the schedule: each gap and automatic period is one block. $config replaces
     * the stored configuration (to foresee a change of the automatic music).
     *
     * @return list<array<string, mixed>>
     */
    public function items(int $from, int $to, bool $expand = true, int $limit = 600, ?array $config = null): array
    {
        $config ??= $this->config->all();
        $live = $this->desk->stored();
        $window = $expand ? $this->switch->window($config, $live, BroadcastClock::nowMs()) : null;
        $hold = $expand ? $live['hold'] : null;
        $items = [];
        $cursor = $from;
        $anchor = null;

        foreach ($this->entries($this->slotsBetween($from, $to), $window, $expand, $hold) as $entry) {
            if ($entry['end'] <= $cursor) {
                continue;
            }
            if ($entry['start'] > $cursor) {
                $anchor ??= $cursor === $from ? $this->anchorBefore($from, $window, $hold) : $cursor;
                array_push($items, ...$this->gap($config, $anchor, $cursor, min($entry['start'], $to), $expand, $limit - count($items)));
            }
            array_push($items, ...$this->entryItems($entry, $config, max($entry['start'], $cursor), min($entry['end'], $to), $expand, $limit - count($items)));
            $cursor = $entry['end'];
            $anchor = $entry['end'];
            if ($cursor >= $to || count($items) >= $limit) {
                break;
            }
        }

        if ($cursor < $to && count($items) < $limit) {
            $anchor ??= $this->anchorBefore($from, $window, $hold);
            array_push($items, ...$this->gap($config, $cursor === $from ? $anchor : $cursor, $cursor, $to, $expand, $limit - count($items)));
        }

        return array_slice($items, 0, $limit);
    }

    /**
     * The song before the one on air, the items from now on (the one on air first; during a
     * crossfade the song fading out comes first and keeps playing) and what sounded before the
     * one on air, newest first: songs, programs and live shows, not commercials, jingles or effects.
     *
     * @return array{0: ?array<string, mixed>, 1: list<array<string, mixed>>, 2: list<array<string, mixed>>}
     */
    public function program(int $now): array
    {
        $items = $this->items($now - self::RECENT_WINDOW, $now + 4 * 3600000, true, 90);
        $current = null;
        foreach ($items as $index => $item) {
            if ($item['start'] <= $now && $now < $item['end']) {
                $current = $index;
            }
        }
        $previous = $current !== null && $current > 0 ? $items[$current - 1] : null;
        $queue = [];
        foreach ($items as $item) {
            if ($item['end'] > $now && count($queue) < 7) {
                $queue[] = $item['start'] < $now ? [...$item, 'start' => $now, 'seek' => round(($now - $item['origin']) / 1000, 3)] : $item;
            }
        }
        $before = $current !== null ? array_slice($items, 0, $current) : array_filter($items, fn (array $item) => $item['end'] <= $now);
        $recent = [];
        foreach (array_reverse($before) as $item) {
            if (in_array($item['kind'], self::UNLISTED, true) || ($recent && $recent[count($recent) - 1]['id'] === $item['id'])) {
                continue;
            }
            $recent[] = $item;
            if (count($recent) >= self::RECENT_ITEMS) {
                break;
            }
        }

        return [$previous, $queue, $recent];
    }

    /**
     * Sounds on top of the program around $now: console pads and players, and overlay blocks of
     * the timeline that are playing or start within the lookahead.
     *
     * @return list<array<string, mixed>>
     */
    public function layers(array $live, int $now): array
    {
        $layers = array_map(fn (array $layer) => [...$layer, 'source' => 'live'], LiveDesk::sounding($live['layers'], $now));

        $scheduled = $this->timeline->blocks($now - Timeline::MAX_BLOCK * 1000, $now + self::LAYER_LOOKAHEAD, false)
            ->filter(fn (ScheduleSlot $slot) => self::playable($slot->track) && $slot->endsAt()->getTimestampMs() > $now);

        foreach ($scheduled as $slot) {
            $layers[] = [
                'id' => 's'.$slot->id,
                'lane' => (string) $slot->layer,
                'track_id' => $slot->track_id,
                'title' => $slot->title,
                'kind' => $slot->kind,
                'src' => $slot->track->file_path,
                'start' => $slot->starts_at->getTimestampMs(),
                'end' => $slot->endsAt()->getTimestampMs(),
                'volume' => $slot->volume,
                'duck' => $slot->duck,
                'fade_in' => 0,
                'fade_out' => 0,
                'loop' => false,
                'source' => 'schedule',
            ];
        }

        return $layers;
    }

    /**
     * Where the gap that contains $at began: the end of the block before it (live blocks only
     * count through the cut, since the music plays across them when nobody is on air; audios
     * waiting for the live transmission do not count either, since they have not played).
     */
    public function anchorBefore(int $at, ?array $window, ?int $hold = null): int
    {
        $previous = $this->timeline->lastBefore($at, $hold);
        $ends = array_filter(
            [$previous?->endsAt()->getTimestampMs(), $window['end'] ?? null],
            fn (?int $end) => $end !== null && $end <= $at,
        );

        return $ends ? max($ends) : self::ROTATION_EPOCH;
    }

    /** Whether an item is a song of the station's automatic music (not of a scheduled period nor the live bed). */
    public static function automatic(array $item): bool
    {
        return $item['kind'] === TrackKind::Song->value && $item['slot'] === null && $item['block'] === null;
    }

    /** Scheduled audios (not live blocks nor automatic periods) that start during the hold wait for it. */
    public static function waits(ScheduleSlot $slot, int $hold): bool
    {
        return ! in_array($slot->kind, [ScheduleSlot::LIVE, ScheduleSlot::AUTO], true) && $slot->starts_at->getTimestampMs() >= $hold;
    }

    /** A scheduled audio sounds only when it is active and its file is healthy; otherwise the music fills its time. */
    public static function playable(?Track $track): bool
    {
        return $track !== null && $track->active && $track->file_problem === null && (string) $track->file_path !== '';
    }

    /**
     * The source of automatic music a config describes, from auto_since.
     *
     * @return array{playlist: ?string, shuffle: bool, start: ?string, from: int}
     */
    public static function current(array $config): array
    {
        return self::source([
            'playlist' => $config['auto_playlist'],
            'shuffle' => $config['auto_shuffle'],
            'start' => $config['auto_start'],
            'from' => $config['auto_since'],
        ]);
    }

    /** @return array{playlist: ?string, shuffle: bool, start: ?string, from: int} */
    public static function source(array $source): array
    {
        $playlist = $source['playlist'] ?? null;
        $start = $source['start'] ?? null;

        return [
            'playlist' => $playlist,
            'shuffle' => $playlist === null || (bool) ($source['shuffle'] ?? true),
            'start' => is_string($start) ? $start : null,
            'from' => (int) ($source['from'] ?? 0),
        ];
    }

    public static function crossfadeMs(array $config): int
    {
        return (int) round($config['crossfade'] * 1000);
    }

    /** @return Collection<int, ScheduleSlot> main-timeline blocks overlapping [from, to) */
    private function slotsBetween(int $from, int $to): Collection
    {
        return $this->timeline->blocks($from - Timeline::MAX_BLOCK * 1000, $to, true)
            ->filter(fn (ScheduleSlot $slot) => $slot->endsAt()->getTimestampMs() > $from
                && (in_array($slot->kind, [ScheduleSlot::LIVE, ScheduleSlot::AUTO], true) || self::playable($slot->track)))
            ->values()
            ->toBase();
    }

    /**
     * The main program as entries of what sounds: scheduled blocks, automatic periods and the
     * live cut, which overrides whatever was scheduled under it. Live blocks only sound while the
     * cut holds them, so outside it they are gaps the music fills. Audios waiting for the live
     * transmission ($hold) are left out until it ends. Back-to-back periods of the same playlist
     * play as one, so a long period does not restart at each block.
     *
     * @return list<array{type: string, start: int, end: int, anchor: int, slot: ?ScheduleSlot, window: ?array}>
     */
    private function entries(Collection $slots, ?array $window, bool $expand, ?int $hold): array
    {
        $entries = [];
        foreach ($slots as $slot) {
            if ($expand && ($slot->kind === ScheduleSlot::LIVE || ($hold !== null && self::waits($slot, $hold)))) {
                continue;
            }
            $start = $slot->starts_at->getTimestampMs();
            foreach (self::outside($start, $slot->endsAt()->getTimestampMs(), $window) as [$begin, $end]) {
                $auto = $slot->kind === ScheduleSlot::AUTO;
                $entries[] = [
                    'type' => $auto ? 'auto' : 'slot',
                    'start' => $begin,
                    'end' => $end,
                    'anchor' => $auto && $begin === $start ? $this->chainStart($slot) : $begin,
                    'slot' => $slot,
                    'window' => null,
                ];
            }
        }
        if ($window) {
            $entries[] = ['type' => 'cut', 'start' => $window['start'], 'end' => $window['end'] ?? PHP_INT_MAX, 'anchor' => $window['start'], 'slot' => null, 'window' => $window];
        }
        usort($entries, fn (array $a, array $b) => $a['start'] <=> $b['start']);

        $merged = [];
        foreach ($entries as $entry) {
            $last = $merged ? $merged[count($merged) - 1] : null;
            if ($last && $last['type'] === 'auto' && $entry['type'] === 'auto' && abs($entry['start'] - $last['end']) <= 50
                && self::sameSource($last['slot'], $entry['slot'])) {
                $merged[count($merged) - 1]['end'] = $entry['end'];

                continue;
            }
            $merged[] = $entry;
        }

        return $merged;
    }

    /** @return list<array{0: int, 1: int}> the parts of [start, end) outside the live cut */
    private static function outside(int $start, int $end, ?array $window): array
    {
        $cutFrom = $window['start'] ?? PHP_INT_MAX;
        $cutTo = $window ? ($window['end'] ?? PHP_INT_MAX) : PHP_INT_MAX;
        if ($cutTo <= $start || $cutFrom >= $end) {
            return [[$start, $end]];
        }

        return array_values(array_filter([[$start, $cutFrom], [$cutTo, $end]], fn (array $part) => $part[1] > $part[0]));
    }

    private static function sameSource(ScheduleSlot $a, ScheduleSlot $b): bool
    {
        return $a->playlist_id === $b->playlist_id && $a->shuffle === $b->shuffle;
    }

    /** Where a run of back-to-back automatic periods of the same playlist began. */
    private function chainStart(ScheduleSlot $slot): int
    {
        $start = $slot->starts_at->getTimestampMs();
        for ($step = 0; $step < 8; $step++) {
            $previous = $this->timeline->previous($start);
            if (! $previous || $previous->kind !== ScheduleSlot::AUTO || ! self::sameSource($previous, $slot)
                || abs($previous->endsAt()->getTimestampMs() - $start) > 50) {
                break;
            }
            $start = $previous->starts_at->getTimestampMs();
        }

        return $start;
    }

    /** @return list<array<string, mixed>> what an entry plays between $begin and $finish */
    private function entryItems(array $entry, array $config, int $begin, int $finish, bool $expand, int $limit): array
    {
        if ($finish <= $begin || $limit <= 0) {
            return [];
        }
        $crossfade = self::crossfadeMs($config);
        $slot = $entry['slot'];

        if ($entry['type'] === 'auto') {
            if (! $expand) {
                return [self::block('a'.$slot->id, self::FILL, $slot->title, $begin, $finish, $entry['start'])];
            }

            $source = $this->autopilot->resolve($slot->playlist_id, (bool) $slot->shuffle, $crossfade);

            return Autopilot::fill($source['songs'], $source['shuffle'], $entry['anchor'], $begin, $finish, $limit, ['block' => $slot->title]);
        }

        if ($entry['type'] === 'cut') {
            $window = $entry['window'];
            if ($window['bed']) {
                $source = $this->autopilot->resolve($config['auto_playlist'], (bool) $config['auto_shuffle'], $crossfade);
                if ($source['songs']) {
                    return Autopilot::fill($source['songs'], $source['shuffle'], $window['start'], $begin, $finish, $limit, ['kind' => ScheduleSlot::LIVE, 'bed' => true, 'block' => $window['title']]);
                }
            }

            return [[...self::block('live-'.$window['start'], ScheduleSlot::LIVE, $window['title'], $begin, $finish, $window['start']), 'block' => $window['title'], 'slot' => $window['slot']]];
        }

        return [self::slotItem($slot, $begin, $finish)];
    }

    /**
     * Automatic music of a gap, from the station's source. A source change splits the gap: the
     * old source plays until auto_since, its last song running on to fade into the new source,
     * which starts fresh there. After a start by hand (auto_prev «fade») the song on air does not
     * run on: it fades out over the first seconds of the new source.
     *
     * @return list<array<string, mixed>>
     */
    private function gap(array $config, int $anchor, int $from, int $to, bool $expand, int $limit): array
    {
        if ($to <= $from || ! $config['autofill'] || $limit <= 0) {
            return [];
        }
        $crossfade = self::crossfadeMs($config);
        $since = (int) $config['auto_since'];
        $current = self::current($config);
        $until = $config['auto_repeat'] || $config['auto_until'] === null ? null : (int) $config['auto_until'];
        if (! $expand) {
            $end = $until !== null ? min($to, $until) : $to;

            return $end > $from && $this->autopilot->songs($current['playlist'], $crossfade)
                ? [self::block('gap-'.$from, self::FILL, 'Música continua', $from, $end, $from)]
                : [];
        }

        $previous = is_array($config['auto_prev']) ? self::source($config['auto_prev']) : null;
        $fade = $previous !== null && ! empty($config['auto_prev']['fade']) ? max(self::START_FADE, $crossfade) : 0;
        $parts = [];
        if ($since <= $anchor) {
            $parts[] = [$anchor, $from, $to, $current, false, 0, $until];
        } else {
            $tail = $previous !== null && $since < $to && ! empty($config['auto_prev']['tail']);
            if ($previous !== null && ($from < $since || ($tail && $from < $since + $crossfade) || $from < $since + $fade)) {
                $start = max($anchor, $previous['from']);
                $parts[] = [$start, max($start, min($from, $since - 1)), min($since, $to), $previous, $tail, $fade, null];
            }
            if ($since < $to) {
                $parts[] = [$since, max($since, $from), $to, $current, false, 0, $until];
            }
        }

        $items = [];
        foreach ($parts as [$start, $begin, $end, $source, $tail, $fadeOut, $stop]) {
            $resolved = $this->autopilot->resolve($source['playlist'], $source['shuffle'], $crossfade);
            if ($stop !== null && $stop < $end) {
                array_push($items, ...self::lastCycle($resolved, $source, $start, $begin, $end, $stop, $limit - count($items)));

                continue;
            }
            $songs = Autopilot::fill($resolved['songs'], $resolved['shuffle'], $start, $begin, $end, $limit - count($items), [], $tail, $source['start']);
            if ($fadeOut > 0 && $end === $since) {
                $lengths = array_column($resolved['songs'], 'ms', 'id');
                foreach ($songs as &$song) {
                    if ($song['end'] === $since) {
                        $song['end'] = min($song['origin'] + ($lengths[$song['track']] ?? 0), $since + $fadeOut, $to);
                    }
                }
                unset($song);
                $songs = array_values(array_filter($songs, fn (array $song) => $song['end'] > $from));
            }
            array_push($items, ...$songs);
        }

        return $items;
    }

    /**
     * Songs of a source without repeat between $begin and $end: those that start before $stop
     * play to their end (never past $end), and then silence.
     *
     * @return list<array<string, mixed>>
     */
    private static function lastCycle(array $resolved, array $source, int $start, int $begin, int $end, int $stop, int $limit): array
    {
        $songs = Autopilot::fill($resolved['songs'], $resolved['shuffle'], $start, min($begin, $stop - 1), $stop, $limit, [], true, $source['start']);
        $heard = [];
        foreach ($songs as $song) {
            $song['end'] = min($song['end'], $end);
            if ($song['end'] <= $begin) {
                continue;
            }
            if ($song['start'] < $begin) {
                $song['start'] = $begin;
                $song['seek'] = round(($begin - $song['origin']) / 1000, 3);
            }
            $heard[] = $song;
        }

        return $heard;
    }

    /** @return array<string, mixed> */
    private static function block(string $id, string $kind, string $title, int $begin, int $finish, int $origin): array
    {
        return [
            'id' => $id,
            'kind' => $kind,
            'title' => $title,
            'artist' => null,
            'src' => null,
            'cover' => null,
            'start' => $begin,
            'end' => $finish,
            'origin' => $origin,
            'seek' => round(($begin - $origin) / 1000, 3),
            'bed' => false,
            'block' => null,
            'slot' => null,
            'track' => null,
        ];
    }

    /** @return array<string, mixed> */
    private static function slotItem(ScheduleSlot $slot, int $begin, int $finish): array
    {
        $start = $slot->starts_at->getTimestampMs();
        $live = $slot->kind === ScheduleSlot::LIVE;

        return [
            'id' => 's'.$slot->id,
            'kind' => $slot->kind,
            'title' => $slot->title,
            'artist' => $slot->track?->credit(),
            'src' => $live ? null : $slot->track?->file_path,
            'cover' => $live ? null : $slot->track?->cover_path,
            'start' => $begin,
            'end' => $finish,
            'origin' => $start,
            'seek' => round(($begin - $start) / 1000, 3),
            'bed' => false,
            'block' => $live ? $slot->title : null,
            'slot' => $slot->id,
            'track' => $slot->track_id,
        ];
    }
}
