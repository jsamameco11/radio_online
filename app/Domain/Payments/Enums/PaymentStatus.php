<?php

namespace App\Domain\Payments\Enums;

enum PaymentStatus: string
{
    case Pending = 'pending';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
    case Cancelled = 'cancelled';
    case Refunded = 'refunded';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pendiente',
            self::Succeeded => 'Pagado',
            self::Failed => 'Fallido',
            self::Cancelled => 'Cancelado',
            self::Refunded => 'Reembolsado',
        };
    }
}
