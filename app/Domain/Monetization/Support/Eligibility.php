<?php

namespace App\Domain\Monetization\Support;

use App\Domain\Growth\Support\DayRuns;
use Carbon\CarbonImmutable;

/**
 * Whether a station may ask to become a "Radio monetizada": enough
 * subscribers and, on $requiredDays consecutive local days, at least one live
 * broadcast that reached $threshold simultaneous listeners.
 */
final readonly class Eligibility
{
    /**
     * @param  list<array{date: string, peak: int}>  $bestRun  the longest run of qualifying days
     * @param  list<array{date: string, peak: int, qualifies: bool}>  $recentDays  oldest first
     */
    public function __construct(
        public int $subscribers,
        public int $minSubscribers,
        public int $threshold,
        public int $requiredDays,
        public array $bestRun,
        public int $currentRun,
        public array $recentDays,
    ) {}

    /**
     * @param  array<string, int>  $qualifyingPeaks  day => peak, only days that reached the threshold
     * @param  array<string, int>  $recentPeaks  day => peak of the last days with a broadcast
     */
    public static function evaluate(
        int $subscribers,
        array $qualifyingPeaks,
        array $recentPeaks,
        string $today,
        int $recentDays,
        int $minSubscribers,
        int $threshold,
        int $requiredDays,
    ): self {
        $days = array_keys($qualifyingPeaks);
        $first = CarbonImmutable::parse($today)->subDays($recentDays - 1);

        return new self(
            $subscribers,
            $minSubscribers,
            $threshold,
            $requiredDays,
            array_map(fn (string $day) => ['date' => $day, 'peak' => $qualifyingPeaks[$day]], DayRuns::longest($days)),
            count(DayRuns::alive($days, $today)),
            array_map(function (int $offset) use ($first, $recentPeaks, $threshold) {
                $day = $first->addDays($offset)->toDateString();
                $peak = $recentPeaks[$day] ?? 0;

                return ['date' => $day, 'peak' => $peak, 'qualifies' => $peak >= $threshold];
            }, range(0, $recentDays - 1)),
        );
    }

    public function hasSubscribers(): bool
    {
        return $this->subscribers >= $this->minSubscribers;
    }

    public function hasLiveAudience(): bool
    {
        return count($this->bestRun) >= $this->requiredDays;
    }

    public function eligible(): bool
    {
        return $this->hasSubscribers() && $this->hasLiveAudience();
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'eligible' => $this->eligible(),
            'subscribers' => ['current' => $this->subscribers, 'target' => $this->minSubscribers, 'met' => $this->hasSubscribers()],
            'live' => [
                'threshold' => $this->threshold,
                'days_required' => $this->requiredDays,
                'best_run' => count($this->bestRun),
                'best_run_days' => $this->bestRun,
                'current_run' => $this->currentRun,
                'recent_days' => $this->recentDays,
                'met' => $this->hasLiveAudience(),
            ],
        ];
    }

    /**
     * The figures kept with a monetization request.
     *
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        return [
            'subscribers' => $this->subscribers,
            'min_subscribers' => $this->minSubscribers,
            'live_listeners' => $this->threshold,
            'live_days' => $this->requiredDays,
            'qualifying_days' => $this->bestRun,
            'evaluated_at' => now()->toIso8601String(),
        ];
    }
}
