<?php

namespace App\Domain\Applications\Enums;

enum Weekday: string
{
    case Monday = 'mon';
    case Tuesday = 'tue';
    case Wednesday = 'wed';
    case Thursday = 'thu';
    case Friday = 'fri';
    case Saturday = 'sat';
    case Sunday = 'sun';

    public function label(): string
    {
        return match ($this) {
            self::Monday => 'Lunes',
            self::Tuesday => 'Martes',
            self::Wednesday => 'Miércoles',
            self::Thursday => 'Jueves',
            self::Friday => 'Viernes',
            self::Saturday => 'Sábado',
            self::Sunday => 'Domingo',
        };
    }
}
