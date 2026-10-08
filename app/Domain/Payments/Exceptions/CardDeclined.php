<?php

namespace App\Domain\Payments\Exceptions;

use App\Domain\Wallet\Exceptions\WalletException;

/** The issuer refused the card. Nothing was charged. */
final class CardDeclined extends WalletException
{
    public function __construct(?string $message = null)
    {
        parent::__construct($message ?: 'Tu banco rechazó la tarjeta. Prueba con otra.');
    }

    public function reason(): string
    {
        return 'card_declined';
    }
}
