<?php

namespace App\Domain\Frequencies\Enums;

enum FrequencyRequestStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'En revisión',
            self::Approved => 'Aprobada',
            self::Rejected => 'Rechazada',
            self::Cancelled => 'Cancelada',
        };
    }
}
