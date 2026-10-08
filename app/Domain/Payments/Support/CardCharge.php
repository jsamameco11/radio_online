<?php

namespace App\Domain\Payments\Support;

/** One charge of a saved card ("crd_…") or a fresh token ("tkn_…"). */
final readonly class CardCharge
{
    /**
     * @param  array<string, string>  $metadata
     * @param  array<string, string>|null  $authentication3ds
     */
    public function __construct(
        public string $source,
        public int $amountCents,
        public string $currency,
        public string $email,
        public string $description,
        public array $metadata = [],
        public ?array $authentication3ds = null,
    ) {}
}
