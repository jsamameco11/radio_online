<?php

namespace App\Domain\Chat\Enums;

/** Who wrote a chat message: a listener, or the station team answering as the station. */
enum ChatAuthor: string
{
    case Listener = 'listener';
    case Station = 'station';

    public function label(): string
    {
        return match ($this) {
            self::Listener => 'Oyente',
            self::Station => 'Emisora',
        };
    }
}
