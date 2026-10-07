<?php

namespace App\Domain\Growth;

use App\Domain\Growth\Enums\GoalMetric;
use App\Domain\Growth\Support\Goal;

/**
 * The growth journey every station walks: first steps, streaks, subscribers
 * and live audience, ending at the monetization thresholds of
 * config('platform.monetization').
 */
final class Goals
{
    public const STREAKS = [2, 3, 7, 14, 30];

    private const SUBSCRIBERS = [10, 50, 100, 500, 1000, 2500];

    private const LIVE_PEAKS = [10, 50, 100, 250, 500];

    /**
     * Every goal, in the order the journey proposes them: the next goal of a
     * station is the first one it has not reached.
     *
     * @return list<Goal>
     */
    public static function all(): array
    {
        $minSubscribers = (int) config('platform.monetization.min_subscribers');
        $liveListeners = (int) config('platform.monetization.live_listeners');
        $liveDays = (int) config('platform.monetization.live_days');

        $steps = [
            [0, 0, new Goal('first_episode', GoalMetric::Episodes, 1, 'Publica tu primer episodio', 'Sube un programa grabado para que te escuchen cuando quieran.')],
            [0, 1, new Goal('first_live', GoalMetric::Lives, 1, 'Sal en vivo por primera vez', 'Abre la consola y saluda a tu audiencia en directo.')],
        ];

        foreach (self::STREAKS as $index => $days) {
            $steps[] = [$index + 1, 0, new Goal("streak_{$days}", GoalMetric::Streak, $days, "{$days} días seguidos", "Sal en vivo o publica un episodio {$days} días seguidos.")];
        }

        foreach (self::ladder(self::SUBSCRIBERS, $minSubscribers) as $index => $subscribers) {
            $steps[] = [$index + 2, 1, new Goal(
                "subscribers_{$subscribers}",
                GoalMetric::Subscribers,
                $subscribers,
                self::number($subscribers).' suscriptores',
                $subscribers === $minSubscribers
                    ? 'La meta de suscriptores para solicitar la monetización.'
                    : 'Invita a tus amigos y oyentes a suscribirse a tu radio.',
            )];
        }

        foreach (self::ladder(self::LIVE_PEAKS, $liveListeners) as $index => $listeners) {
            $steps[] = [$index + 2, 2, new Goal(
                "live_peak_{$listeners}",
                GoalMetric::LivePeak,
                $listeners,
                self::number($listeners).' oyentes en vivo',
                $listeners === $liveListeners
                    ? "Sostenlo {$liveDays} días seguidos y podrás solicitar la monetización."
                    : 'Reúne '.self::number($listeners).' personas escuchándote al mismo tiempo.',
            )];
        }

        usort($steps, fn (array $a, array $b) => [$a[0], $a[1]] <=> [$b[0], $b[1]]);

        return array_map(fn (array $step) => $step[2], $steps);
    }

    /**
     * @param  list<int>  $steps
     * @return list<int> the steps below $top, then $top
     */
    private static function ladder(array $steps, int $top): array
    {
        return [...array_values(array_filter($steps, fn (int $step) => $step < $top)), $top];
    }

    /** 5000 → "5.000" */
    private static function number(int $value): string
    {
        return number_format($value, 0, ',', '.');
    }
}
