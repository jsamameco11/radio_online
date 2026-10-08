<?php

namespace App\Domain\Frequencies\Enums;

enum FrequencyRequestStatus: string
{
    case Pending = 'pending';
    /** Approved by the staff, but the charge of a priced frequency did not go through. */
    case AwaitingPayment = 'awaiting_payment';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';

    /** Still waiting on someone: the staff (pending) or the applicant's payment. */
    public function isOpen(): bool
    {
        return $this === self::Pending || $this === self::AwaitingPayment;
    }

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'En revisión',
            self::AwaitingPayment => 'Aprobada · pago pendiente',
            self::Approved => 'Aprobada',
            self::Rejected => 'Rechazada',
            self::Cancelled => 'Cancelada',
        };
    }
}
