<?php

namespace App\Domain\Integrity\Enums;

enum AlertStatus: string
{
    case Open = 'open';
    case Purged = 'purged';
    case Dismissed = 'dismissed';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Abierta',
            self::Purged => 'Depurada',
            self::Dismissed => 'Descartada',
        };
    }
}
