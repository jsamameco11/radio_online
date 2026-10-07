<?php

namespace App\Domain\Wallet\Exceptions;

final class InsufficientBalance extends WalletException
{
    public function __construct(public readonly int $balanceCents, public readonly int $requiredCents)
    {
        parent::__construct('Tu saldo no alcanza para esta operación. Recarga tu billetera e inténtalo de nuevo.');
    }

    public function reason(): string
    {
        return 'insufficient_balance';
    }
}
