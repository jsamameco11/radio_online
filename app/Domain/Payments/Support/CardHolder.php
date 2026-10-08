<?php

namespace App\Domain\Payments\Support;

/** The person a card is registered for, as the processor asks for it. */
final readonly class CardHolder
{
    public function __construct(
        public string $firstName,
        public string $lastName,
        public string $email,
        public string $phone,
        public string $countryCode,
        public string $city,
        public string $address,
    ) {}
}
