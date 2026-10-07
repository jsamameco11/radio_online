<?php

namespace App\Domain\Payments\Support;

/** Where to send the listener to pay, and the provider's id for that checkout. */
final readonly class CheckoutSession
{
    public function __construct(
        public string $url,
        public string $reference,
    ) {}
}
