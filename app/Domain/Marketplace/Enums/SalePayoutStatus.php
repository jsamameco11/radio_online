<?php

namespace App\Domain\Marketplace\Enums;

/** The money of a sale the platform owes the seller. */
enum SalePayoutStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Por pagar',
            self::Paid => 'Pagado',
        };
    }
}
