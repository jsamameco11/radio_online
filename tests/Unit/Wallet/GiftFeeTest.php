<?php

namespace Tests\Unit\Wallet;

use App\Domain\Gifts\Support\GiftFee;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class GiftFeeTest extends TestCase
{
    #[Test]
    public function the_station_receives_eighty_five_percent_of_one_dollar(): void
    {
        $fee = GiftFee::split(100, 5, 10);

        $this->assertSame([5, 10, 85], $this->parts($fee));
        $this->assertSame(15, $fee->deductedCents());
    }

    #[Test]
    public function each_deduction_is_rounded_half_up_and_the_station_gets_the_rest(): void
    {
        $this->assertSame([0, 0, 1], $this->parts(GiftFee::split(1, 5, 10)));
        $this->assertSame([0, 1, 4], $this->parts(GiftFee::split(5, 5, 10)));
        $this->assertSame([1, 1, 8], $this->parts(GiftFee::split(10, 5, 10)));
        $this->assertSame([5, 10, 84], $this->parts(GiftFee::split(99, 5, 10)));
        $this->assertSame([250, 500, 4250], $this->parts(GiftFee::split(5000, 5, 10)));
    }

    #[Test]
    public function out_of_range_percentages_are_clamped(): void
    {
        $this->assertSame([0, 0, 500], $this->parts(GiftFee::split(500, -10, -5)));
        $this->assertSame([500, 0, 0], $this->parts(GiftFee::split(500, 150, 10)));
        $this->assertSame([100, 400, 0], $this->parts(GiftFee::split(500, 20, 95)));
    }

    #[Test]
    #[DataProvider('amounts')]
    public function the_parts_always_add_up_to_the_total(int $total, int $processor, int $platform): void
    {
        $fee = GiftFee::split($total, $processor, $platform);

        $this->assertSame($total, $fee->processorFeeCents + $fee->platformFeeCents + $fee->stationAmountCents);
        $this->assertGreaterThanOrEqual(0, $fee->stationAmountCents);
    }

    /**
     * @return iterable<string, array{int, int, int}>
     */
    public static function amounts(): iterable
    {
        foreach ([1, 2, 3, 7, 99, 100, 101, 333, 999, 1001, 9999, 990_000] as $total) {
            foreach ([[0, 0], [5, 10], [3, 7], [50, 50], [49, 51], [100, 0], [0, 100]] as [$processor, $platform]) {
                yield "{$total} at {$processor}%+{$platform}%" => [$total, $processor, $platform];
            }
        }
    }

    /**
     * @return array{int, int, int}
     */
    private function parts(GiftFee $fee): array
    {
        return [$fee->processorFeeCents, $fee->platformFeeCents, $fee->stationAmountCents];
    }
}
