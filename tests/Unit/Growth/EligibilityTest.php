<?php

namespace Tests\Unit\Growth;

use App\Domain\Monetization\Support\Eligibility;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class EligibilityTest extends TestCase
{
    #[Test]
    public function three_consecutive_qualifying_days_and_enough_subscribers_make_a_station_eligible(): void
    {
        $eligibility = $this->evaluate(5000, ['2026-10-03' => 812, '2026-10-04' => 950, '2026-10-05' => 801]);

        $this->assertTrue($eligibility->eligible());
        $this->assertSame(
            [['date' => '2026-10-03', 'peak' => 812], ['date' => '2026-10-04', 'peak' => 950], ['date' => '2026-10-05', 'peak' => 801]],
            $eligibility->bestRun,
        );
        $this->assertSame(0, $eligibility->currentRun);
    }

    #[Test]
    public function non_consecutive_days_do_not_count(): void
    {
        $eligibility = $this->evaluate(9000, ['2026-10-01' => 900, '2026-10-03' => 900, '2026-10-05' => 900, '2026-10-06' => 900]);

        $this->assertFalse($eligibility->hasLiveAudience());
        $this->assertFalse($eligibility->eligible());
        $this->assertCount(2, $eligibility->bestRun);
        $this->assertSame(2, $eligibility->currentRun);
    }

    #[Test]
    public function subscribers_below_the_minimum_are_not_enough(): void
    {
        $eligibility = $this->evaluate(4999, ['2026-10-03' => 900, '2026-10-04' => 900, '2026-10-05' => 900]);

        $this->assertTrue($eligibility->hasLiveAudience());
        $this->assertFalse($eligibility->hasSubscribers());
        $this->assertFalse($eligibility->eligible());
    }

    #[Test]
    public function recent_days_list_every_day_with_its_peak(): void
    {
        $eligibility = Eligibility::evaluate(10, [], ['2026-10-07' => 120, '2026-10-05' => 850], '2026-10-07', 3, 5000, 800, 3);

        $this->assertSame([
            ['date' => '2026-10-05', 'peak' => 850, 'qualifies' => true],
            ['date' => '2026-10-06', 'peak' => 0, 'qualifies' => false],
            ['date' => '2026-10-07', 'peak' => 120, 'qualifies' => false],
        ], $eligibility->recentDays);
    }

    /**
     * @param  array<string, int>  $qualifying
     */
    private function evaluate(int $subscribers, array $qualifying): Eligibility
    {
        return Eligibility::evaluate($subscribers, $qualifying, $qualifying, '2026-10-07', 14, 5000, 800, 3);
    }
}
