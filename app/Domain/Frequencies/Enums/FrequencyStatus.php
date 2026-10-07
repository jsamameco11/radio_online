<?php

namespace App\Domain\Frequencies\Enums;

enum FrequencyStatus: string
{
    case Available = 'available';
    case Reserved = 'reserved';
    case Active = 'active';
    case Suspended = 'suspended';
    case Maintenance = 'maintenance';

    public function label(): string
    {
        return match ($this) {
            self::Available => 'Disponible',
            self::Reserved => 'Reservada',
            self::Active => 'Activa',
            self::Suspended => 'Suspendida',
            self::Maintenance => 'Mantenimiento',
        };
    }
}
