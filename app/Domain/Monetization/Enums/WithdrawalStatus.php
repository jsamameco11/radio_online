<?php

namespace App\Domain\Monetization\Enums;

enum WithdrawalStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'En proceso',
            self::Paid => 'Pagado',
            self::Rejected => 'Rechazado',
        };
    }
}
