<?php

namespace App\Domain\Marketplace\Enums;

enum ListingStatus: string
{
    case Active = 'active';
    case Sold = 'sold';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'En venta',
            self::Sold => 'Vendida',
            self::Cancelled => 'Retirada',
        };
    }
}
