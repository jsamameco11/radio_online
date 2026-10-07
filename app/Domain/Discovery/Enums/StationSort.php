<?php

namespace App\Domain\Discovery\Enums;

/** How listings of stations are ordered. */
enum StationSort: string
{
    case Listeners = 'listeners';
    case Followers = 'followers';
    case Newest = 'new';

    public function label(): string
    {
        return match ($this) {
            self::Listeners => 'Más escuchadas',
            self::Followers => 'Más seguidas',
            self::Newest => 'Nuevas',
        };
    }
}
