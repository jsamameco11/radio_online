<?php

namespace App\Domain\Discovery\Enums;

enum CategoryGroup: string
{
    case Music = 'music';
    case Information = 'information';
    case Entertainment = 'entertainment';
    case Education = 'education';
    case Specialized = 'specialized';

    public function label(): string
    {
        return match ($this) {
            self::Music => 'Música',
            self::Information => 'Información',
            self::Entertainment => 'Entretenimiento',
            self::Education => 'Educación',
            self::Specialized => 'Especializadas',
        };
    }
}
