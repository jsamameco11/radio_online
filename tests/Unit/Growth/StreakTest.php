<?php

namespace Tests\Unit\Growth;

use App\Domain\Growth\Enums\StreakState;
use App\Domain\Growth\Support\DayRuns;
use App\Domain\Growth\Support\Streak;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class StreakTest extends TestCase
{
    #[Test]
    public function days_are_grouped_in_runs_of_consecutive_dates(): void
    {
        $runs = DayRuns::of(['2026-10-03', '2026-09-30', '2026-10-01', '2026-10-01', '2026-10-05', '2026-10-04']);

        $this->assertSame([['2026-09-30', '2026-10-01'], ['2026-10-03', '2026-10-04', '2026-10-05']], $runs);
        $this->assertSame(['2026-10-03', '2026-10-04', '2026-10-05'], DayRuns::longest(['2026-10-03', '2026-09-30', '2026-10-01', '2026-10-05', '2026-10-04']));
        $this->assertSame([], DayRuns::longest([]));
    }

    #[Test]
    public function a_run_crossing_months_and_years_stays_together(): void
    {
        $this->assertCount(1, DayRuns::of(['2026-12-30', '2026-12-31', '2027-01-01']));
        $this->assertCount(1, DayRuns::of(['2028-02-28', '2028-02-29', '2028-03-01']));
    }

    #[Test]
    public function the_streak_counts_today_when_today_is_active(): void
    {
        $streak = Streak::from(['2026-10-05', '2026-10-06', '2026-10-07'], '2026-10-07');

        $this->assertSame(3, $streak->current);
        $this->assertTrue($streak->activeToday);
        $this->assertSame(StreakState::Active, $streak->state());
        $this->assertSame('¡Llevas 3 días seguidos!', $streak->headline());
        $this->assertSame('Vuelve mañana y suma 4. Tu próxima meta: 7 días seguidos.', $streak->message(7));
    }

    #[Test]
    public function the_streak_stays_alive_until_midnight(): void
    {
        $streak = Streak::from(['2026-10-05', '2026-10-06'], '2026-10-07');

        $this->assertSame(2, $streak->current);
        $this->assertFalse($streak->activeToday);
        $this->assertSame(StreakState::AtRisk, $streak->state());
        $this->assertStringContainsString('antes de la medianoche para llegar a 3', $streak->message(3));
    }

    #[Test]
    public function two_days_in_a_row_announce_the_third(): void
    {
        $streak = Streak::from(['2026-10-06', '2026-10-07'], '2026-10-07');

        $this->assertSame('¡Llevas 2 días seguidos!', $streak->headline());
        $this->assertSame('Mañana completas 3 días seguidos. ¡No la sueltes!', $streak->message(3));
    }

    #[Test]
    public function a_missed_day_resets_the_streak_but_keeps_the_best(): void
    {
        $streak = Streak::from(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-05'], '2026-10-07');

        $this->assertSame(0, $streak->current);
        $this->assertSame(4, $streak->best);
        $this->assertSame(StreakState::Broken, $streak->state());
        $this->assertSame('Tu racha se reinició', $streak->headline());
    }

    #[Test]
    public function a_station_without_activity_starts_fresh(): void
    {
        $streak = Streak::from([], '2026-10-07');

        $this->assertSame(StreakState::Fresh, $streak->state());
        $this->assertSame('Empieza tu racha hoy', $streak->headline());
    }
}
