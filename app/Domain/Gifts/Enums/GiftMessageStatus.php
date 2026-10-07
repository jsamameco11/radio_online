<?php

namespace App\Domain\Gifts\Enums;

enum GiftMessageStatus: string
{
    case Visible = 'visible';
    case Hidden = 'hidden';
    case Reported = 'reported';

    public function label(): string
    {
        return match ($this) {
            self::Visible => 'Visible',
            self::Hidden => 'Oculto',
            self::Reported => 'Reportado',
        };
    }
}
