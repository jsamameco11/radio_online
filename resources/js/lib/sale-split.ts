/** Mirrors App\Domain\Marketplace\Support\SaleSplit, for previews only: the backend computes the real split. */
export interface SaleSplitPercents {
  processorFeePercent: number;
  feePercent: number;
  taxPercent: number;
}

const percentOf = (cents: number, percent: number) => Math.floor((cents * Math.max(0, Math.min(100, percent)) + 50) / 100);

/** A station its owner sells: card processor fee, platform commission and its tax leave; the seller gets the rest. */
export function saleSplit(priceCents: number, { processorFeePercent, feePercent, taxPercent }: SaleSplitPercents) {
  const processorFeeCents = percentOf(priceCents, processorFeePercent);
  const feeCents = percentOf(priceCents, feePercent);
  const taxCents = percentOf(feeCents, taxPercent);

  return {
    processorFeeCents,
    feeCents,
    taxCents,
    sellerCents: Math.max(priceCents - processorFeeCents - feeCents - taxCents, 0),
  };
}

/** A frequency the platform sells: only the card processor fee leaves. */
export function platformSaleSplit(priceCents: number, processorFeePercent: number) {
  const processorFeeCents = percentOf(priceCents, processorFeePercent);

  return { processorFeeCents, platformCents: priceCents - processorFeeCents };
}
