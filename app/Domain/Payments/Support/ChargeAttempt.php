<?php

namespace App\Domain\Payments\Support;

/**
 * What the browser sends to pay a top-up: the provider's single-use card
 * token, the payer's email and, after a 3-D Secure challenge, its result.
 * Never an amount: the amount always comes from the payment row.
 */
final readonly class ChargeAttempt
{
    /**
     * @param  array<string, string>|null  $authentication3ds
     */
    public function __construct(
        public string $token,
        public string $email,
        public ?array $authentication3ds = null,
    ) {}
}
