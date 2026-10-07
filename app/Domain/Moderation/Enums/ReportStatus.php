<?php

namespace App\Domain\Moderation\Enums;

enum ReportStatus: string
{
    case Open = 'open';
    case Reviewing = 'reviewing';
    case Resolved = 'resolved';
    case Dismissed = 'dismissed';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Abierto',
            self::Reviewing => 'En revisión',
            self::Resolved => 'Resuelto',
            self::Dismissed => 'Descartado',
        };
    }
}
