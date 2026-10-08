<?php

namespace App\Domain\Marketplace\Support;

/**
 * Where the price of a sale goes, each part rounded half up to the cent:
 * the card processor fee (config('platform.marketplace.processor_fee_percent')),
 * the platform commission (fee_percent), the tax on that commission
 * (tax_percent, IGV) and the rest for the seller.
 */
final readonly class SaleSplit
{
    public function __construct(
        public int $priceCents,
        public int $processorFeeCents,
        public int $feeCents,
        public int $taxCents,
        public int $sellerCents,
    ) {}

    public static function of(int $priceCents, ?int $processorPercent = null, ?int $feePercent = null, ?int $taxPercent = null): self
    {
        $processor = self::percentOf($priceCents, $processorPercent ?? self::processorFeePercent());
        $fee = self::percentOf($priceCents, $feePercent ?? self::feePercent());
        $tax = self::percentOf($fee, $taxPercent ?? self::taxPercent());
        $deducted = min($priceCents, $processor + $fee + $tax);

        return new self($priceCents, $processor, $fee, $tax, $priceCents - $deducted);
    }

    /** A frequency the platform sells itself: only the card processor fee leaves; the platform keeps the rest. */
    public static function forPlatform(int $priceCents): self
    {
        $processor = self::percentOf($priceCents, self::processorFeePercent());

        return new self($priceCents, $processor, $priceCents - $processor, 0, 0);
    }

    public static function processorFeePercent(): int
    {
        return (int) config('platform.marketplace.processor_fee_percent');
    }

    public static function feePercent(): int
    {
        return (int) config('platform.marketplace.fee_percent');
    }

    public static function taxPercent(): int
    {
        return (int) config('platform.marketplace.tax_percent');
    }

    private static function percentOf(int $cents, int $percent): int
    {
        return intdiv($cents * max(0, min(100, $percent)) + 50, 100);
    }
}
