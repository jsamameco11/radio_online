<?php

namespace App\Domain\Wallet\Exceptions;

final class WalletFrozen extends WalletException
{
    public function __construct()
    {
        parent::__construct('Esta billetera está congelada. Escríbenos para revisar tu caso.');
    }

    public function reason(): string
    {
        return 'wallet_frozen';
    }
}
