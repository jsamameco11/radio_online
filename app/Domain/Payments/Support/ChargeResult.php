<?php

namespace App\Domain\Payments\Support;

use App\Domain\Payments\Enums\ChargeStatus;

/** The provider's verdict on a charge, with the message to show the payer. */
final readonly class ChargeResult
{
    /**
     * @param  array<string, mixed>  $meta
     */
    private function __construct(
        public ChargeStatus $status,
        public ?string $reference = null,
        public ?string $message = null,
        public array $meta = [],
    ) {}

    /**
     * @param  array<string, mixed>  $meta
     */
    public static function succeeded(string $reference, array $meta = []): self
    {
        return new self(ChargeStatus::Succeeded, $reference, meta: $meta);
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    public static function declined(string $message, array $meta = []): self
    {
        return new self(ChargeStatus::Declined, message: $message, meta: $meta);
    }

    public static function requiresAuthentication(string $message): self
    {
        return new self(ChargeStatus::RequiresAuthentication, message: $message);
    }
}
