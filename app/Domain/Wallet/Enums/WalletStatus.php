<?php

namespace App\Domain\Wallet\Enums;

enum WalletStatus: string
{
    case Active = 'active';
    case Frozen = 'frozen';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Activa',
            self::Frozen => 'Congelada',
        };
    }
}
