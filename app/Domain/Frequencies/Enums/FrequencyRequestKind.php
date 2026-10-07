<?php

namespace App\Domain\Frequencies\Enums;

/**
 * A request either opens a new station ("Crear mi radio") or moves an
 * existing station to another frequency.
 */
enum FrequencyRequestKind: string
{
    case NewStation = 'new_station';
    case FrequencyChange = 'frequency_change';

    public function label(): string
    {
        return match ($this) {
            self::NewStation => 'Nueva emisora',
            self::FrequencyChange => 'Cambio de frecuencia',
        };
    }
}
