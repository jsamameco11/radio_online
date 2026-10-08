<?php

namespace App\Domain\Payments\Support;

/** A card kept on file by the processor; only its references and a hint are stored. */
final readonly class SavedCard
{
    public function __construct(
        public string $customerId,
        public string $cardId,
        public ?string $brand,
        public ?string $lastFour,
    ) {}
}
