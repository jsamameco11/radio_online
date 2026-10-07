<?php

namespace App\Domain\Gifts\Support;

/**
 * Splits what a listener pays for a gift between the platform and the
 * station. The platform share is rounded half up to the cent and the station
 * receives exactly the rest, so the two parts always add up to the total.
 */
final readonly class GiftFee
{
    public function __construct(
        public int $totalCents,
        public int $platformFeeCents,
        public int $stationAmountCents,
    ) {}

    public static function split(int $totalCents, ?int $percent = null): self
    {
        $percent = max(0, min(100, $percent ?? (int) config('platform.wallet.platform_fee_percent')));
        $fee = intdiv($totalCents * $percent + 50, 100);

        return new self($totalCents, $fee, $totalCents - $fee);
    }
}
