<?php

namespace App\Domain\Studio\Broadcast;

use App\Domain\Storage\MediaStorage;
use App\Models\Playlist;
use App\Models\ScheduleSlot;
use App\Models\Track;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Editing of the current station's timeline. Blocks of the same layer never overlap; the main
 * layer holds the program and the overlay layers sound on top of it. Times are UTC milliseconds.
 */
final class Schedule
{
    /** Two blocks may touch with this much overlap (ms) without counting as a conflict. */
    private const TOLERANCE = 50;

    public function __construct(
        private readonly Timeline $timeline,
        private readonly MediaStorage $storage,
    ) {}

    /** @return Collection<int, ScheduleSlot> blocks that overlap [from, to), of one layer or of all */
    public function between(int $from, int $to, ?string $ignore = null, ?int $layer = null): Collection
    {
        return ScheduleSlot::query()->with(['track', 'playlist'])
            ->where('starts_at', '>=', BroadcastClock::utc($from - Timeline::MAX_BLOCK * 1000))
            ->where('starts_at', '<', BroadcastClock::utc($to))
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore))
            ->when($layer !== null, fn ($query) => $query->where('layer', $layer))
            ->orderBy('starts_at')
            ->get()
            ->filter(fn (ScheduleSlot $slot) => $slot->endsAt()->getTimestampMs() > $from)
            ->values()
            ->toBase();
    }

    /**
     * Blocks of a calendar day on every layer, including ones that began the day before.
     *
     * @return list<array<string, mixed>>
     */
    public function day(string $date): array
    {
        [$from, $to] = BroadcastClock::dayBounds($date);

        return $this->between($from, $to)->map(fn (ScheduleSlot $slot) => $this->payload($slot))->values()->all();
    }

    /** @return array<string, mixed> */
    public function payload(ScheduleSlot $slot): array
    {
        return [
            'id' => $slot->id,
            'kind' => $slot->kind,
            'layer' => $slot->layer,
            'title' => $slot->title,
            'artist' => $slot->track?->credit(),
            'note' => $slot->note,
            'bed' => $slot->bed,
            'duck' => $slot->duck,
            'volume' => $slot->volume,
            'duration' => $slot->duration,
            'track_id' => $slot->track_id,
            'playlist_id' => $slot->playlist_id,
            'playlist' => $slot->kind === ScheduleSlot::AUTO ? ($slot->playlist?->name ?? Autopilot::RANDOM) : null,
            'shuffle' => $slot->shuffle,
            'src' => $this->storage->url($slot->track?->file_path),
            'inactive' => $slot->track !== null && (! $slot->track->active || $slot->track->file_problem !== null),
            'start' => $slot->starts_at->getTimestampMs(),
            'end' => $slot->endsAt()->getTimestampMs(),
        ];
    }

    public function conflict(int $start, int $end, int $layer = ScheduleSlot::MAIN, ?string $ignore = null): ?ScheduleSlot
    {
        return $this->between($start + self::TOLERANCE, $end - self::TOLERANCE, $ignore, $layer)->first();
    }

    /** End of the last block of a layer that starts on the given day, or null when it is empty. */
    public function dayEnd(string $date, int $layer = ScheduleSlot::MAIN): ?int
    {
        [$from, $to] = BroadcastClock::dayBounds($date);
        $last = ScheduleSlot::query()->where('layer', $layer)
            ->where('starts_at', '>=', BroadcastClock::utc($from))->where('starts_at', '<', BroadcastClock::utc($to))
            ->orderByDesc('starts_at')->first();

        return $last?->endsAt()->getTimestampMs();
    }

    /** @return array<int, ?int> ends of the last block of each layer on a day, keyed by layer */
    public function dayEnds(string $date): array
    {
        return collect(range(ScheduleSlot::MAIN, ScheduleSlot::OVERLAYS))
            ->mapWithKeys(fn (int $layer) => [$layer => $this->dayEnd($date, $layer)])->all();
    }

    /**
     * Blocks for library audios. Overlays keep their own volume and may lower the music; $duck
     * null takes each audio's default.
     *
     * @param  Collection<int, Track>  $tracks
     * @return list<array<string, mixed>>
     */
    public static function trackBlocks(Collection $tracks, ?string $note = null, int $layer = ScheduleSlot::MAIN, ?bool $duck = null, int $volume = 100): array
    {
        return $tracks->map(fn (Track $track) => [
            'kind' => $track->kind->value,
            'layer' => $layer,
            'title' => $track->title,
            'duration' => $track->duration,
            'track_id' => $track->id,
            'playlist_id' => null,
            'bed' => false,
            'shuffle' => false,
            'duck' => $layer === ScheduleSlot::MAIN ? false : ($duck ?? $track->duck),
            'volume' => $layer === ScheduleSlot::MAIN ? 100 : max(0, min(100, $volume)),
            'note' => $note,
        ])->values()->all();
    }

    /**
     * An automatic-music period of the main layer, split into blocks of at most MAX_BLOCK (they
     * play as one, since back-to-back periods of the same playlist never restart). Without a
     * playlist it plays random songs.
     *
     * @return list<array<string, mixed>>
     */
    public static function autoBlocks(?Playlist $playlist, bool $shuffle, int $seconds, ?string $note = null): array
    {
        $blocks = [];
        $shuffle = $playlist === null || $shuffle;
        $title = self::autoTitle($playlist, $shuffle);
        for ($left = $seconds; $left > 0; $left -= Timeline::MAX_BLOCK) {
            $blocks[] = [
                'kind' => ScheduleSlot::AUTO,
                'layer' => ScheduleSlot::MAIN,
                'title' => $title,
                'duration' => min($left, Timeline::MAX_BLOCK),
                'track_id' => null,
                'playlist_id' => $playlist?->id,
                'bed' => false,
                'shuffle' => $shuffle,
                'duck' => false,
                'volume' => 100,
                'note' => $note,
            ];
        }

        return $blocks;
    }

    public static function autoTitle(?Playlist $playlist, bool $shuffle): string
    {
        return 'Música automática · '.($playlist ? $playlist->name.($shuffle ? ' · aleatorio' : ' · en orden') : Autopilot::RANDOM);
    }

    /**
     * A live block of the main layer: the music gives way to the host while it lasts.
     *
     * @return array<string, mixed>
     */
    public static function liveBlock(string $title, float $minutes, bool $bed, ?string $note): array
    {
        return [
            'kind' => ScheduleSlot::LIVE,
            'layer' => ScheduleSlot::MAIN,
            'title' => $title,
            'duration' => round($minutes * 60, 2),
            'track_id' => null,
            'playlist_id' => null,
            'bed' => $bed,
            'shuffle' => false,
            'duck' => false,
            'volume' => 100,
            'note' => $note,
        ];
    }

    /**
     * Active library audios in the given order; ids no longer in the library are skipped.
     *
     * @param  list<string>  $ids
     * @return Collection<int, Track>
     */
    public static function tracks(array $ids): Collection
    {
        $found = Track::query()->whereIn('id', array_unique($ids))->where('active', true)->get()->keyBy('id');

        return collect($ids)->map(fn (string $id) => $found->get($id))->filter()->values();
    }

    public static function layerLabel(int $layer): string
    {
        return $layer === ScheduleSlot::MAIN ? 'pista principal' : "capa {$layer}";
    }

    public static function conflictMessage(ScheduleSlot $conflict): string
    {
        return 'Se cruza con «'.$conflict->title.'» en la '.self::layerLabel($conflict->layer)
            .' ('.BroadcastClock::clock($conflict->starts_at->getTimestampMs()).'–'.BroadcastClock::clock($conflict->endsAt()->getTimestampMs()).').';
    }

    public static function length(array $blocks): int
    {
        return (int) round(array_sum(array_column($blocks, 'duration')) * 1000);
    }

    /** Places the blocks one after another from $start. The caller checks conflicts first. */
    public function place(array $blocks, int $start): int
    {
        $cursor = $start;
        foreach ($blocks as $block) {
            ScheduleSlot::query()->create([...$block, 'starts_at' => BroadcastClock::utc($cursor)]);
            $cursor += (int) round($block['duration'] * 1000);
        }
        $this->timeline->flush();

        return $cursor;
    }

    /**
     * «Al aire ahora» on the main layer: cuts the block on air, plays the new blocks right away
     * and pushes the blocks that follow just enough to make room (gaps absorb the push).
     */
    public function insertNow(array $blocks): int
    {
        return DB::transaction(function () use ($blocks) {
            $now = BroadcastClock::nowMs() + 400;
            $current = $this->between($now, $now + 1, null, ScheduleSlot::MAIN)->first();
            $following = ScheduleSlot::query()->where('layer', ScheduleSlot::MAIN)
                ->where('starts_at', '>=', BroadcastClock::utc($now))
                ->where('starts_at', '<', BroadcastClock::utc($now + 24 * 3600 * 1000))
                ->orderBy('starts_at')->get();

            if ($current) {
                $played = ($now - $current->starts_at->getTimestampMs()) / 1000;
                $played < 1 ? $current->delete() : $current->update(['duration' => round($played, 2)]);
            }

            $cursor = $this->place($blocks, $now);
            foreach ($following as $slot) {
                if ($slot->starts_at->getTimestampMs() >= $cursor) {
                    break;
                }
                $slot->update(['starts_at' => BroadcastClock::utc($cursor)]);
                $cursor = $slot->endsAt()->getTimestampMs();
            }
            $this->timeline->flush();

            return $cursor;
        });
    }

    /**
     * When the live transmission ends at $at, the audios of the main program that were due while
     * it lasted (from $since) go on air one after another: after the block on air if it is an
     * audio, or cutting the automatic period or live block on air. The blocks that follow are
     * pushed just enough to make room; automatic periods are shortened instead.
     *
     * @return int how many audios were placed
     */
    public function releaseHeld(int $since, int $at): int
    {
        return DB::transaction(function () use ($since, $at) {
            $held = ScheduleSlot::query()->where('layer', ScheduleSlot::MAIN)->whereNotIn('kind', [ScheduleSlot::LIVE, ScheduleSlot::AUTO])
                ->where('starts_at', '>=', BroadcastClock::utc($since))->where('starts_at', '<', BroadcastClock::utc($at))
                ->orderBy('starts_at')->get();
            if ($held->isEmpty()) {
                return 0;
            }
            $ids = $held->modelKeys();
            $cursor = $at + 400;

            $tail = null;
            $current = $this->between($cursor, $cursor + 1, null, ScheduleSlot::MAIN)
                ->first(fn (ScheduleSlot $slot) => ! in_array($slot->id, $ids, true));
            if ($current && in_array($current->kind, [ScheduleSlot::AUTO, ScheduleSlot::LIVE], true)) {
                $end = $current->endsAt()->getTimestampMs();
                $played = ($cursor - $current->starts_at->getTimestampMs()) / 1000;
                $tail = $current->kind === ScheduleSlot::AUTO ? [$current->replicate(), $end] : null;
                $played < 1 ? $current->delete() : $current->update(['duration' => round($played, 2)]);
            } elseif ($current) {
                $cursor = $current->endsAt()->getTimestampMs();
            }

            foreach ($held as $slot) {
                $slot->update(['starts_at' => BroadcastClock::utc($cursor)]);
                $cursor = $slot->endsAt()->getTimestampMs();
            }
            if ($tail && $tail[1] - $cursor >= 1000) {
                [$rest, $end] = $tail;
                $rest->fill(['starts_at' => BroadcastClock::utc($cursor), 'duration' => round(($end - $cursor) / 1000, 2)])->save();
                $ids[] = $rest->id;
                $cursor = $end;
            }

            $following = ScheduleSlot::query()->where('layer', ScheduleSlot::MAIN)->whereNotIn('id', $ids)
                ->where('starts_at', '>=', BroadcastClock::utc($at))->orderBy('starts_at')->get();
            foreach ($following as $slot) {
                $start = $slot->starts_at->getTimestampMs();
                if ($start >= $cursor) {
                    break;
                }
                $end = $slot->endsAt()->getTimestampMs();
                if ($slot->kind !== ScheduleSlot::AUTO) {
                    $slot->update(['starts_at' => BroadcastClock::utc($cursor)]);
                    $cursor = $slot->endsAt()->getTimestampMs();
                } elseif ($end - $cursor < 1000) {
                    $slot->delete();
                } else {
                    $slot->update(['starts_at' => BroadcastClock::utc($cursor), 'duration' => round(($end - $cursor) / 1000, 2)]);
                    $cursor = $end;
                }
            }
            $this->timeline->flush();

            return $held->count();
        });
    }

    /**
     * Copies the blocks of every layer that start on $date to each target day; blocks that would overlap are skipped.
     *
     * @param  list<string>  $targets
     * @return array{0: int, 1: int} copied and skipped blocks
     */
    public function copyDay(string $date, array $targets, bool $replace): array
    {
        [$from, $to] = BroadcastClock::dayBounds($date);
        $source = ScheduleSlot::query()->where('starts_at', '>=', BroadcastClock::utc($from))->where('starts_at', '<', BroadcastClock::utc($to))
            ->orderBy('starts_at')->get();
        $copied = 0;
        $skipped = 0;

        DB::transaction(function () use ($source, $targets, $replace, $from, &$copied, &$skipped) {
            foreach ($targets as $target) {
                [$targetFrom, $targetTo] = BroadcastClock::dayBounds($target);
                if ($replace) {
                    ScheduleSlot::query()->where('starts_at', '>=', BroadcastClock::utc($targetFrom))
                        ->where('starts_at', '<', BroadcastClock::utc($targetTo))->delete();
                }
                $shift = $targetFrom - $from;
                foreach ($source as $slot) {
                    $start = $slot->starts_at->getTimestampMs() + $shift;
                    $end = $start + (int) round($slot->duration * 1000);
                    if ($this->conflict($start, $end, $slot->layer)) {
                        $skipped++;

                        continue;
                    }
                    ScheduleSlot::query()->create([
                        'starts_at' => BroadcastClock::utc($start),
                        ...$slot->only(['duration', 'kind', 'layer', 'track_id', 'playlist_id', 'title', 'note', 'bed', 'shuffle', 'duck', 'volume']),
                    ]);
                    $copied++;
                }
            }
        });
        $this->timeline->flush();

        return [$copied, $skipped];
    }

    /** Removes the blocks of a day that have not started yet; what already sounded stays. */
    public function clearDay(string $date): int
    {
        [$from, $to] = BroadcastClock::dayBounds($date);
        $removed = ScheduleSlot::query()->where('starts_at', '>=', BroadcastClock::utc(max($from, BroadcastClock::nowMs())))
            ->where('starts_at', '<', BroadcastClock::utc($to))->delete();
        $this->timeline->flush();

        return $removed;
    }

    /**
     * Blocks (all layers) and minutes of the main program scheduled on each of the next days, for the day picker.
     *
     * @return list<array{date: string, blocks: int, seconds: int}>
     */
    public function overview(string $firstDay, int $days): array
    {
        [$from] = BroadcastClock::dayBounds($firstDay);
        $to = $from + $days * 86400000;
        $totals = [];
        $slots = ScheduleSlot::query()->where('starts_at', '>=', BroadcastClock::utc($from))->where('starts_at', '<', BroadcastClock::utc($to))
            ->get(['starts_at', 'duration', 'layer']);
        foreach ($slots as $slot) {
            $day = BroadcastClock::localDay($slot->starts_at->getTimestampMs());
            $totals[$day] ??= ['blocks' => 0, 'seconds' => 0];
            $totals[$day]['blocks']++;
            $totals[$day]['seconds'] += $slot->layer === ScheduleSlot::MAIN ? $slot->duration : 0;
        }

        return collect(range(0, $days - 1))->map(function (int $offset) use ($firstDay, $totals) {
            $day = CarbonImmutable::parse($firstDay, BroadcastClock::timezone())->addDays($offset)->toDateString();

            return ['date' => $day, 'blocks' => $totals[$day]['blocks'] ?? 0, 'seconds' => (int) round($totals[$day]['seconds'] ?? 0)];
        })->all();
    }

    /** Called when a block changes outside this class. */
    public function flush(): void
    {
        $this->timeline->flush();
    }
}
