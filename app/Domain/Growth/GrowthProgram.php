<?php

namespace App\Domain\Growth;

use App\Domain\Growth\Enums\GoalMetric;
use App\Domain\Growth\Support\Goal;
use App\Domain\Growth\Support\Streak;
use App\Domain\Monetization\MonetizationEligibility;
use App\Domain\Stations\Analytics\LocalTime;
use App\Models\Station;
use Carbon\CarbonImmutable;

/**
 * The growth program of a station: its streak of active days, the goals of
 * the journey with their progress, the milestones it unlocked and how close
 * it is to monetization. Computing it unlocks the milestones just reached.
 */
final class GrowthProgram
{
    /** Days of the activity calendar. */
    public const CALENDAR_DAYS = 30;

    public function __construct(
        private readonly StationActivity $activity,
        private readonly Achievements $achievements,
        private readonly MonetizationEligibility $eligibility,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function snapshot(Station $station): array
    {
        $now = CarbonImmutable::now(LocalTime::timezone());
        $today = $now->toDateString();

        $liveDays = $this->activity->liveDays($station);
        $episodeDays = $this->activity->episodeDays($station);
        $streak = Streak::from([...$liveDays, ...$episodeDays], $today);
        $totals = $this->activity->totals($station);
        $eligibility = $this->eligibility->evaluate($station);

        $values = [
            GoalMetric::Episodes->value => $totals['episodes'],
            GoalMetric::Lives->value => $totals['lives'],
            GoalMetric::Streak->value => $streak->current,
            GoalMetric::Subscribers->value => $station->follower_count,
            GoalMetric::LivePeak->value => $totals['best_peak'],
        ];
        $reachedValue = fn (Goal $goal) => $goal->metric === GoalMetric::Streak ? $streak->best : $values[$goal->metric->value];

        $goals = Goals::all();
        $reached = array_map(fn (Goal $goal) => $goal->key, array_values(array_filter($goals, fn (Goal $goal) => $reachedValue($goal) >= $goal->target)));
        if ($eligibility->eligible()) {
            $reached[] = Achievements::MONETIZATION_READY;
        }

        ['achieved' => $achieved, 'fresh' => $fresh] = $this->achievements->unlock($station, $reached);
        $recentSince = $now->subDays(Achievements::RECENT_DAYS);

        $rows = array_map(function (Goal $goal) use ($values, $achieved, $fresh, $recentSince) {
            $achievedAt = $achieved[$goal->key] ?? null;

            return [
                'key' => $goal->key,
                'metric' => $goal->metric->value,
                'title' => $goal->title,
                'description' => $goal->description,
                'target' => $goal->target,
                'current' => $achievedAt !== null ? $goal->target : min($values[$goal->metric->value], $goal->target),
                'achieved' => $achievedAt !== null,
                'achieved_at' => $achievedAt?->toIso8601String(),
                'recent' => $achievedAt !== null && $achievedAt->gte($recentSince),
                'fresh' => in_array($goal->key, $fresh, true),
            ];
        }, $goals);

        $nextStreak = collect(Goals::STREAKS)->first(fn (int $days) => $days > $streak->current);
        $recent = collect($rows)->where('recent', true)->sortByDesc('achieved_at')->values()->all();

        return [
            'today' => $today,
            'metrics' => [...$totals, 'subscribers' => $station->follower_count],
            'streak' => [
                'current' => $streak->current,
                'best' => $streak->best,
                'active_today' => $streak->activeToday,
                'state' => $streak->state()->value,
                'headline' => $streak->headline(),
                'message' => $streak->message($nextStreak),
                'next_target' => $nextStreak,
            ],
            'calendar' => $this->calendar($station, $now, $liveDays, $episodeDays),
            'goals' => $rows,
            'next_goal' => collect($rows)->firstWhere('achieved', false),
            'achieved_count' => collect($rows)->where('achieved', true)->count(),
            'recent' => $recent,
            'monetization' => [...$eligibility->toArray(), 'monetized_at' => $station->monetized_at?->toIso8601String()],
        ];
    }

    /**
     * The compact version the studio dashboard shows.
     *
     * @return array<string, mixed>
     */
    public function summary(Station $station): array
    {
        $snapshot = $this->snapshot($station);
        $monetization = $snapshot['monetization'];

        return [
            'streak' => $snapshot['streak'],
            'week' => array_slice($snapshot['calendar'], -7),
            'next_goal' => $snapshot['next_goal'],
            'achieved_count' => $snapshot['achieved_count'],
            'total_goals' => count($snapshot['goals']),
            'latest_achievement' => $snapshot['recent'][0] ?? null,
            'monetization' => [
                'eligible' => $monetization['eligible'],
                'monetized_at' => $monetization['monetized_at'],
                'subscribers' => $monetization['subscribers'],
                'live' => [
                    'threshold' => $monetization['live']['threshold'],
                    'days_required' => $monetization['live']['days_required'],
                    'best_run' => $monetization['live']['best_run'],
                ],
            ],
        ];
    }

    /**
     * @param  list<string>  $liveDays
     * @param  list<string>  $episodeDays
     * @return list<array{date: string, live: bool, episode: bool, peak: int}>
     */
    private function calendar(Station $station, CarbonImmutable $now, array $liveDays, array $episodeDays): array
    {
        $first = $now->startOfDay()->subDays(self::CALENDAR_DAYS - 1);
        $peaks = $this->activity->dailyPeaks($station, $first->utc());
        $live = array_flip($liveDays);
        $episodes = array_flip($episodeDays);

        return array_map(function (int $offset) use ($first, $peaks, $live, $episodes) {
            $day = $first->addDays($offset)->toDateString();

            return ['date' => $day, 'live' => isset($live[$day]), 'episode' => isset($episodes[$day]), 'peak' => $peaks[$day] ?? 0];
        }, range(0, self::CALENDAR_DAYS - 1));
    }
}
