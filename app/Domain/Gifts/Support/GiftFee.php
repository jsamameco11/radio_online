<?php

namespace App\Domain\Gifts\Support;

/**
 * Splits what a listener pays (a gift or a highlighted chat message) between
 * the card processor, the platform and the station. Each deduction is rounded
 * half up to the cent and the station receives exactly the rest, so the three
 * parts always add up to the total. Stations only ever see their own part.
 */
final readonly class GiftFee
{
    public function __construct(
        public int $totalCents,
        public int $processorFeeCents,
        public int $platformFeeCents,
        public int $stationAmountCents,
    ) {}

    public static function split(int $totalCents, ?int $processorPercent = null, ?int $platformPercent = null): self
    {
        $processorPercent = self::clamp($processorPercent ?? (int) config('platform.wallet.processor_fee_percent'), 100);
        $platformPercent = self::clamp($platformPercent ?? (int) config('platform.wallet.platform_fee_percent'), 100 - $processorPercent);

        $processor = intdiv($totalCents * $processorPercent + 50, 100);
        $platform = min(intdiv($totalCents * $platformPercent + 50, 100), $totalCents - $processor);

        return new self($totalCents, $processor, $platform, $totalCents - $processor - $platform);
    }

    /** Everything kept from the listener's payment before it reaches the station. */
    public function deductedCents(): int
    {
        return $this->processorFeeCents + $this->platformFeeCents;
    }

    private static function clamp(int $percent, int $max): int
    {
        return max(0, min($max, $percent));
    }
}
