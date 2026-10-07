<?php

namespace App\Domain\Stations\Enums;

enum StationVisibility: string
{
    case Public = 'public';
    case Unlisted = 'unlisted';

    public function label(): string
    {
        return match ($this) {
            self::Public => 'Pública',
            self::Unlisted => 'Solo con enlace',
        };
    }
}
