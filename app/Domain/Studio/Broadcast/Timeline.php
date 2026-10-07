<?php

namespace App\Domain\Studio\Broadcast;

use App\Domain\Stations\Support\CurrentStation;
use App\Models\ScheduleSlot;
use App\Models\Track;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The blocks of the current station's timeline around now, kept in the cache so the state every
 * listener polls is computed without a round trip to the database. It covers SPAN before and
 * after the moment it was built and is rebuilt once now drifts DRIFT away from it, or as soon as
 * a block or an audio changes (flush). Ranges it does not cover are read from the database.
 */
final class Timeline
{
    /** Longest block the timeline accepts, in seconds. */
    public const MAX_BLOCK = 6 * 3600;

    private const SPAN = 48 * 3600000;

    private const DRIFT = 12 * 3600000;

    /**
     * Snapshot already read by this instance, reused while its generation is the current one.
     *
     * @var array{station: int, generation: string, center: int, from: int, to: int, slots: Collection<int, ScheduleSlot>, before: ?ScheduleSlot, after: ?ScheduleSlot}|null
     */
    private ?array $memo = null;

    public function __construct(private readonly CurrentStation $current) {}

    /** Called whenever a block or an audio changes; again after the transaction commits, so no snapshot keeps what it replaced. */
    public function flush(): void
    {
        $key = $this->current->key('timeline.generation');
        $state = $this->current->key('state');
        Cache::forever($key, Str::random(12));
        Cache::forget($state);
        DB::afterCommit(function () use ($key, $state) {
            Cache::forever($key, Str::random(12));
            Cache::forget($state);
        });
        $this->memo = null;
    }

    /**
     * Blocks of the main program ($main) or of the overlay layers starting in [$from, $to), oldest first, with their audio.
     *
     * @return Collection<int, ScheduleSlot>
     */
    public function blocks(int $from, int $to, bool $main): Collection
    {
        $snapshot = $this->covering($from, $to);
        if ($snapshot === null) {
            return ScheduleSlot::query()->with('track')->where('layer', $main ? '=' : '>', ScheduleSlot::MAIN)
                ->where('starts_at', '>=', BroadcastClock::utc($from))->where('starts_at', '<', BroadcastClock::utc($to))
                ->orderBy('starts_at')->get();
        }

        return $snapshot['slots']->filter(fn (ScheduleSlot $slot) => ($slot->layer === ScheduleSlot::MAIN) === $main
            && self::start($slot) >= $from && self::start($slot) < $to)->values();
    }

    /** The last block of the main program before $at that is not a live block (nor an audio still waiting for the live transmission since $hold). */
    public function lastBefore(int $at, ?int $hold): ?ScheduleSlot
    {
        $counts = fn (ScheduleSlot $slot) => $slot->layer === ScheduleSlot::MAIN && $slot->kind !== ScheduleSlot::LIVE
            && ($hold === null || $slot->kind === ScheduleSlot::AUTO || self::start($slot) < $hold);
        $snapshot = $this->covering($at, $at);
        if ($snapshot !== null) {
            $found = $snapshot['slots']->filter(fn (ScheduleSlot $slot) => self::start($slot) < $at && $counts($slot))->last()
                ?? $snapshot['before'];
            if ($found === null || $counts($found)) {
                return $found;
            }
        }

        return ScheduleSlot::query()->where('layer', ScheduleSlot::MAIN)->where('kind', '!=', ScheduleSlot::LIVE)
            ->when($hold !== null, fn (Builder $query) => $query->where(fn (Builder $query) => $query->where('kind', ScheduleSlot::AUTO)
                ->orWhere('starts_at', '<', BroadcastClock::utc($hold))))
            ->where('starts_at', '<', BroadcastClock::utc($at))->orderByDesc('starts_at')->first();
    }

    /** The block of the main program right before $start, if it began within the longest block. */
    public function previous(int $start): ?ScheduleSlot
    {
        $from = $start - self::MAX_BLOCK * 1000;
        if ($this->covering($from, $start) !== null) {
            return $this->blocks($from, $start, true)->last();
        }

        return ScheduleSlot::query()->where('layer', ScheduleSlot::MAIN)
            ->where('starts_at', '<', BroadcastClock::utc($start))->where('starts_at', '>=', BroadcastClock::utc($from))
            ->orderByDesc('starts_at')->first();
    }

    /** The next scheduled block of the main program after $now that is not an automatic-music period. */
    public function nextShow(int $now): ?ScheduleSlot
    {
        $snapshot = $this->covering($now, $now);
        if ($snapshot !== null) {
            return $snapshot['slots']->first(fn (ScheduleSlot $slot) => $slot->layer === ScheduleSlot::MAIN
                && $slot->kind !== ScheduleSlot::AUTO && self::start($slot) > $now) ?? $snapshot['after'];
        }

        return ScheduleSlot::query()->where('layer', ScheduleSlot::MAIN)->where('kind', '!=', ScheduleSlot::AUTO)
            ->where('starts_at', '>', BroadcastClock::utc($now))->orderBy('starts_at')->first();
    }

    /** The scheduled live block on air at $now, if any. */
    public function liveSlot(int $now): ?ScheduleSlot
    {
        return $this->blocks($now - self::MAX_BLOCK * 1000, $now + 1, true)->reverse()
            ->first(fn (ScheduleSlot $slot) => $slot->kind === ScheduleSlot::LIVE && $slot->endsAt()->getTimestampMs() > $now);
    }

    /** @return array{station: int, generation: string, center: int, from: int, to: int, slots: Collection<int, ScheduleSlot>, before: ?ScheduleSlot, after: ?ScheduleSlot}|null */
    private function covering(int $from, int $to): ?array
    {
        $snapshot = $this->snapshot(BroadcastClock::nowMs());

        return $from >= $snapshot['from'] && $to <= $snapshot['to'] ? $snapshot : null;
    }

    /** @return array{station: int, generation: string, center: int, from: int, to: int, slots: Collection<int, ScheduleSlot>, before: ?ScheduleSlot, after: ?ScheduleSlot} */
    private function snapshot(int $now): array
    {
        $station = (int) $this->current->id();
        $generation = (string) Cache::rememberForever($this->current->key('timeline.generation'), fn () => Str::random(12));
        $fresh = fn (mixed $snapshot) => is_array($snapshot) && ($snapshot['generation'] ?? null) === $generation
            && ($snapshot['station'] ?? null) === $station
            && is_int($snapshot['center'] ?? null) && abs($now - $snapshot['center']) <= self::DRIFT
            && (is_array($snapshot['slots'] ?? null) || ($snapshot['slots'] ?? null) instanceof Collection);
        if ($fresh($this->memo)) {
            return $this->memo;
        }
        $key = $this->current->key('timeline.'.$generation);
        $cached = Cache::get($key);
        if (! $fresh($cached)) {
            $cached = $this->build($station, $generation, $now);
            Cache::put($key, $cached, now()->addDay());
        }

        return $this->memo = [
            ...$cached,
            'slots' => new Collection(array_map(fn (array $row) => self::unpack($row), $cached['slots'])),
            'before' => $cached['before'] ? self::unpack($cached['before']) : null,
            'after' => $cached['after'] ? self::unpack($cached['after']) : null,
        ];
    }

    /**
     * The cache only takes plain values, so the blocks travel as their raw columns.
     *
     * @return array{station: int, generation: string, center: int, from: int, to: int, slots: list<array<string, mixed>>, before: ?array<string, mixed>, after: ?array<string, mixed>}
     */
    private function build(int $station, string $generation, int $now): array
    {
        $from = $now - self::SPAN;
        $to = $now + self::SPAN;
        $before = ScheduleSlot::query()->where('layer', ScheduleSlot::MAIN)->where('kind', '!=', ScheduleSlot::LIVE)
            ->where('starts_at', '<', BroadcastClock::utc($from))->orderByDesc('starts_at')->first();
        $after = ScheduleSlot::query()->where('layer', ScheduleSlot::MAIN)->where('kind', '!=', ScheduleSlot::AUTO)
            ->where('starts_at', '>=', BroadcastClock::utc($to))->orderBy('starts_at')->first();

        return [
            'station' => $station,
            'generation' => $generation,
            'center' => $now,
            'from' => $from,
            'to' => $to,
            'slots' => ScheduleSlot::query()->with('track')
                ->where('starts_at', '>=', BroadcastClock::utc($from))->where('starts_at', '<', BroadcastClock::utc($to))
                ->orderBy('starts_at')->orderBy('layer')->get()
                ->map(fn (ScheduleSlot $slot) => ['slot' => $slot->getAttributes(), 'track' => $slot->track?->getAttributes()])->all(),
            'before' => $before ? ['slot' => $before->getAttributes()] : null,
            'after' => $after ? ['slot' => $after->getAttributes()] : null,
        ];
    }

    /** @param  array{slot: array<string, mixed>, track?: ?array<string, mixed>}  $row */
    private static function unpack(array $row): ScheduleSlot
    {
        $slot = (new ScheduleSlot)->newFromBuilder($row['slot']);
        $slot->setRelation('track', isset($row['track']) ? (new Track)->newFromBuilder($row['track']) : null);

        return $slot;
    }

    private static function start(ScheduleSlot $slot): int
    {
        return $slot->starts_at->getTimestampMs();
    }
}
