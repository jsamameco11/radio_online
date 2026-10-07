<?php

namespace App\Domain\Applications\Enums;

enum EducationLevel: string
{
    case Secondary = 'secondary';
    case Technical = 'technical';
    case University = 'university';
    case Postgraduate = 'postgraduate';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Secondary => 'Secundaria',
            self::Technical => 'Técnico',
            self::University => 'Universitario',
            self::Postgraduate => 'Posgrado',
            self::Other => 'Otro',
        };
    }
}
