<?php

namespace App\Domain\Growth\Support;

use App\Domain\Growth\Enums\StreakState;

/**
 * Consecutive active days of a station (it went live or published an
 * episode), with the words that keep the team going.
 */
final readonly class Streak
{
    public function __construct(
        public int $current,
        public int $best,
        public bool $activeToday,
    ) {}

    /**
     * @param  iterable<string>  $activeDays  local dates, "2026-10-07"
     */
    public static function from(iterable $activeDays, string $today): self
    {
        $days = collect($activeDays)->all();
        $alive = DayRuns::alive($days, $today);

        return new self(count($alive), count(DayRuns::longest($days)), in_array($today, $alive, true));
    }

    public function state(): StreakState
    {
        return match (true) {
            $this->current > 0 && $this->activeToday => StreakState::Active,
            $this->current > 0 => StreakState::AtRisk,
            $this->best > 0 => StreakState::Broken,
            default => StreakState::Fresh,
        };
    }

    public function headline(): string
    {
        return match ($this->state()) {
            StreakState::Active => $this->current === 1 ? '¡Primer día de tu racha!' : "¡Llevas {$this->current} días seguidos!",
            StreakState::AtRisk => '¡Tu racha de '.self::days($this->current).' sigue viva!',
            StreakState::Broken => 'Tu racha se reinició',
            StreakState::Fresh => 'Empieza tu racha hoy',
        };
    }

    /** @param  ?int  $nextTarget  the next streak goal still to reach */
    public function message(?int $nextTarget): string
    {
        $tomorrow = $this->current + 1;

        return match ($this->state()) {
            StreakState::Active => match (true) {
                $nextTarget === null => 'Superaste todas las metas de racha. Tu constancia es tu mejor publicidad: ¡sigue así!',
                $nextTarget === $tomorrow => "Mañana completas {$nextTarget} días seguidos. ¡No la sueltes!",
                default => "Vuelve mañana y suma {$tomorrow}. Tu próxima meta: {$nextTarget} días seguidos.",
            },
            StreakState::AtRisk => "Sal en vivo o publica un episodio antes de la medianoche para llegar a {$tomorrow}.",
            StreakState::Broken => 'Hoy es un gran día para volver: sal en vivo o publica un episodio. Tu mejor racha fue de '.self::days($this->best).', ¡puedes superarla!',
            StreakState::Fresh => 'Sal en vivo o publica un episodio hoy y suma tu primer día. Los canales que crecen aparecen todos los días.',
        };
    }

    private static function days(int $count): string
    {
        return $count === 1 ? '1 día' : "{$count} días";
    }
}
