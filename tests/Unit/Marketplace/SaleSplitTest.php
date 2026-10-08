<?php

namespace Tests\Unit\Marketplace;

use App\Domain\Marketplace\Support\SaleSplit;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class SaleSplitTest extends TestCase
{
    #[Test]
    public function the_processor_fee_commission_and_its_tax_leave_and_the_rest_goes_to_the_seller(): void
    {
        $split = SaleSplit::of(150000, 5, 10, 18);
        $this->assertSame(
            [150000, 7500, 15000, 2700, 124800],
            [$split->priceCents, $split->processorFeeCents, $split->feeCents, $split->taxCents, $split->sellerCents],
        );
    }

    #[Test]
    public function every_part_is_rounded_half_up_to_the_cent(): void
    {
        $odd = SaleSplit::of(5005, 5, 10, 18);

        $this->assertSame([250, 501, 90, 4164], [$odd->processorFeeCents, $odd->feeCents, $odd->taxCents, $odd->sellerCents]);
    }

    #[Test]
    public function percentages_are_clamped_and_the_seller_never_gets_less_than_zero(): void
    {
        $this->assertSame(5000, SaleSplit::of(5000, 0, 0, 0)->sellerCents);
        $this->assertSame(5000, SaleSplit::of(5000, 0, 150, 0)->feeCents);
        $this->assertSame(0, SaleSplit::of(5000, 60, 60, 18)->sellerCents);
    }
}
