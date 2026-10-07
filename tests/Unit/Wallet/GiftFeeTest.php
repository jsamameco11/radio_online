<?php

namespace Tests\Unit\Wallet;

use App\Domain\Gifts\Support\GiftFee;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class GiftFeeTest extends TestCase
{
    #[Test]
    public function the_default_split_keeps_thirty_percent_for_the_platform(): void
    {
        $fee = GiftFee::split(1000, 30);

        $this->assertSame(300, $fee->platformFeeCents);
        $this->assertSame(700, $fee->stationAmountCents);
    }

    #[Test]
    public function the_platform_share_is_rounded_half_up_and_the_station_gets_the_rest(): void
    {
        $this->assertSame([1, 0], $this->parts(GiftFee::split(1, 50)));
        $this->assertSame([1, 1], $this->parts(GiftFee::split(2, 50)));
        $this->assertSame([1, 2], $this->parts(GiftFee::split(3, 30)));
        $this->assertSame([2, 3], $this->parts(GiftFee::split(5, 30)));
        $this->assertSame([30, 69], $this->parts(GiftFee::split(99, 30)));
    }

    #[Test]
    public function out_of_range_percentages_are_clamped(): void
    {
        $this->assertSame([0, 500], $this->parts(GiftFee::split(500, -10)));
        $this->assertSame([500, 0], $this->parts(GiftFee::split(500, 150)));
    }

    #[Test]
    #[DataProvider('amounts')]
    public function the_parts_always_add_up_to_the_total(int $total, int $percent): void
    {
        $fee = GiftFee::split($total, $percent);

        $this->assertSame($total, $fee->platformFeeCents + $fee->stationAmountCents);
        $this->assertGreaterThanOrEqual(0, $fee->stationAmountCents);
    }

    /**
     * @return iterable<string, array{int, int}>
     */
    public static function amounts(): iterable
    {
        foreach ([1, 2, 3, 7, 99, 100, 101, 333, 999, 1001, 9999, 990_000] as $total) {
            foreach ([0, 1, 15, 30, 33, 50, 99, 100] as $percent) {
                yield "{$total} at {$percent}%" => [$total, $percent];
            }
        }
    }

    /**
     * @return array{int, int}
     */
    private function parts(GiftFee $fee): array
    {
        return [$fee->platformFeeCents, $fee->stationAmountCents];
    }
}
