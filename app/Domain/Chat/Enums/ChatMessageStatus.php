<?php

namespace App\Domain\Chat\Enums;

enum ChatMessageStatus: string
{
    case Visible = 'visible';
    case Hidden = 'hidden';

    public function label(): string
    {
        return match ($this) {
            self::Visible => 'Visible',
            self::Hidden => 'Oculto',
        };
    }
}
