<?php

namespace App\Domain\Streaming;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Library\FileProblem;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Jobs\VerifyTrackFile;
use App\Models\Track;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Health of the current station's library files, so the radio never sends listeners to a file
 * that cannot sound.
 *
 * An audio only leaves the air when two independent signals agree, never on a single one:
 *  - the storage says the file is missing or empty in two checks at least a minute apart, or
 *    once right after a listener's player failed to play it;
 *  - or the file is there but the players of several different listeners failed with it.
 * A storage that does not answer decides nothing, and when a check would take most of the
 * library off the air the storage is assumed to be failing instead (the circuit breaker).
 * Problems are checked again later, so a file that comes back returns to the air on its own.
 */
final class PlaybackHealth
{
    /** The file is there but the players of several listeners could not play it. */
    public const UNPLAYABLE = 'unplayable';

    private const OK = 'ok';

    /** Smaller files are not real audio. */
    private const MIN_BYTES = 1024;

    /** A file that failed once is checked again after this many seconds. */
    private const CONFIRM_AFTER = 60;

    private const SWEEP_BATCH = 3;

    private const RECHECK_HOURS = 6;

    private const PROBLEM_RECHECK_MINUTES = 15;

    /** An audio the listeners could not play stays off the air at least this long. */
    private const UNPLAYABLE_HOURS = 6;

    /** Different listeners (by network address) whose players must fail with the same audio. */
    private const REPORTS_NEEDED = 3;

    private const REPORT_WINDOW = 30 * 60;

    /** A storage check of a reported audio runs at most this often. */
    private const REPORT_CHECK_EVERY = 120;

    /** Never take more than this share of the library off the air: past it, the storage is failing. */
    private const MAX_BROKEN_SHARE = 0.5;

    private const MIN_LIBRARY_FOR_BREAKER = 4;

    public function __construct(
        private readonly CurrentStation $current,
        private readonly MediaStorage $storage,
        private readonly PlayoutCaches $caches,
    ) {}

    public static function enabled(): bool
    {
        return (bool) config('platform.streaming.verify_files', true);
    }

    /** Active audios that are off the air because of their file. */
    public function brokenCount(): int
    {
        return Track::query()->where('active', true)->whereNotNull('file_problem')->count();
    }

    /** Files waiting for a second check first, then problems due again, then the oldest checks. */
    public function sweep(): void
    {
        $confirm = array_keys(array_filter($this->pending(), fn (int $due) => $due <= now()->getTimestamp()));
        $tracks = Track::query()->where('active', true)->whereIn('id', $confirm)->limit(self::SWEEP_BATCH)->get();

        $left = self::SWEEP_BATCH - $tracks->count();
        if ($left > 0) {
            $tracks = $tracks->concat(Track::query()->where('active', true)->whereNotIn('id', $tracks->modelKeys())
                ->where(fn ($query) => $query->whereNull('file_checked_at')
                    ->orWhere('file_checked_at', '<', now()->subHours(self::RECHECK_HOURS))
                    ->orWhere(fn ($query) => $query->whereNotNull('file_problem')
                        ->where('file_checked_at', '<', now()->subMinutes(self::PROBLEM_RECHECK_MINUTES))))
                ->orderByRaw('case when file_problem is null then 1 else 0 end')
                ->orderByRaw('case when file_checked_at is null then 0 else 1 end')
                ->orderBy('file_checked_at')
                ->limit($left)->get());
        }

        $tracks->each(fn (Track $track) => $this->check($track));
    }

    /**
     * A listener's player could not play an audio. The report alone changes nothing: it makes the
     * station check the file now, and counts towards the listeners that failed with it.
     */
    public function report(Track $track, string $address): void
    {
        if (! self::enabled() || ! $track->active || $track->file_problem !== null) {
            return;
        }
        $key = $this->key("reports.{$track->id}");
        $since = now()->getTimestamp() - self::REPORT_WINDOW;
        $reports = array_filter((array) Cache::get($key, []), fn (int $at) => $at >= $since);
        $reports[hash('sha256', $address)] = now()->getTimestamp();
        Cache::put($key, $reports, self::REPORT_WINDOW);

        $firstReport = Cache::add($this->key("reported.{$track->id}"), 1, self::REPORT_CHECK_EVERY);
        $enoughListeners = count($reports) >= self::REPORTS_NEEDED && Cache::add($this->key("listeners.{$track->id}"), 1, 30);
        if ($firstReport || $enoughListeners) {
            VerifyTrackFile::dispatchAfterResponse($this->current->get()->id, $track->id, true);
        }
    }

    /**
     * Checks one file and records the verdict.
     *
     * @return string|null the verdict (ok, missing or empty), or null when the storage did not answer
     */
    public function check(Track $track, bool $reported = false): ?string
    {
        $verdict = $this->inspect($track->file_path);
        if ($verdict === null) {
            Log::notice('Streaming: the storage did not answer the check of an audio.', ['track' => $track->id]);

            return null;
        }
        $secondCheck = $this->takePending($track->id);

        if ($verdict === self::OK) {
            $listenersFailed = $reported && count((array) Cache::get($this->key("reports.{$track->id}"), [])) >= self::REPORTS_NEEDED;
            if ($listenersFailed) {
                $this->markBroken($track, self::UNPLAYABLE);
            } elseif ($track->file_problem !== self::UNPLAYABLE || $track->file_problem_at?->lt(now()->subHours(self::UNPLAYABLE_HOURS))) {
                $wasBroken = $track->file_problem !== null;
                $track->forceFill(['file_checked_at' => now(), 'file_problem' => null, 'file_problem_at' => null])->saveQuietly();
                if ($wasBroken) {
                    Log::info('Streaming: an audio is back on the air.', ['track' => $track->id, 'title' => $track->title]);
                    $this->caches->flush();
                }
            } else {
                $track->forceFill(['file_checked_at' => now()])->saveQuietly();
            }

            return $verdict;
        }

        if ($track->file_problem !== null) {
            $track->forceFill(['file_checked_at' => now()])->saveQuietly();
        } elseif ($reported || $secondCheck) {
            $this->markBroken($track, $verdict);
        } else {
            $this->confirmLater($track->id);
        }

        return $verdict;
    }

    /** What the storage says about a file: ok, missing, empty, or null when it does not answer. */
    private function inspect(?string $key): ?string
    {
        if ($key === null || $key === '' || str_starts_with($key, 'http')) {
            return null;
        }
        try {
            $disk = $this->storage->disk($this->storage->folderOf($key));
            if (! $disk->exists($key)) {
                return FileProblem::Missing->value;
            }

            return $disk->size($key) < self::MIN_BYTES ? FileProblem::Empty->value : self::OK;
        } catch (Throwable) {
            return null;
        }
    }

    private function markBroken(Track $track, string $problem): void
    {
        $active = Track::query()->where('active', true)->count();
        if ($active >= self::MIN_LIBRARY_FOR_BREAKER && ($this->brokenCount() + 1) / $active > self::MAX_BROKEN_SHARE) {
            Log::critical('Streaming: most of a library looks broken; the storage is assumed to be failing and nothing is taken off the air.', [
                'station' => $this->current->id(), 'track' => $track->id, 'problem' => $problem,
            ]);
            $track->forceFill(['file_checked_at' => now()])->saveQuietly();

            return;
        }
        $track->forceFill(['file_checked_at' => now(), 'file_problem' => $problem, 'file_problem_at' => now()])->saveQuietly();
        Cache::forget($this->key("reports.{$track->id}"));
        Log::warning('Streaming: an audio left the air because of its file.', ['station' => $this->current->id(), 'track' => $track->id, 'problem' => $problem]);
        $this->caches->flush();
    }

    /** @return array<string, int> track id => when its second check is due */
    private function pending(): array
    {
        return (array) Cache::get($this->key('pending'), []);
    }

    private function confirmLater(string $id): void
    {
        $stale = now()->getTimestamp() - 86400;
        $pending = array_filter($this->pending(), fn (int $due) => $due >= $stale);
        Cache::forever($this->key('pending'), [...$pending, $id => now()->getTimestamp() + self::CONFIRM_AFTER]);
    }

    /** Whether this check is the second one of a file that already failed once, a minute or more ago. */
    private function takePending(string $id): bool
    {
        $pending = $this->pending();
        if (! isset($pending[$id]) || $pending[$id] > now()->getTimestamp()) {
            return false;
        }
        unset($pending[$id]);
        Cache::forever($this->key('pending'), $pending);

        return true;
    }

    private function key(string $name): string
    {
        return $this->current->key('health.'.$name);
    }
}
