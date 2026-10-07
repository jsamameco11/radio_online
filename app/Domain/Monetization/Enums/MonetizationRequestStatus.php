<?php

namespace App\Domain\Monetization\Enums;

enum MonetizationRequestStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'En revisión',
            self::Approved => 'Aprobada',
            self::Rejected => 'Rechazada',
        };
    }
}
