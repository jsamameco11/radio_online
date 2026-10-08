<?php

namespace App\Domain\Integrity\Enums;

/** Whether a subscription counts in the station's subscribers. */
enum FollowStatus: string
{
    case Pending = 'pending';
    case Counted = 'counted';
    case Discarded = 'discarded';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'En verificación',
            self::Counted => 'Contada',
            self::Discarded => 'Descartada',
        };
    }
}
