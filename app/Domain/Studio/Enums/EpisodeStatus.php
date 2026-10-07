<?php

namespace App\Domain\Studio\Enums;

enum EpisodeStatus: string
{
    case Draft = 'draft';
    case Scheduled = 'scheduled';
    case Published = 'published';
    case Archived = 'archived';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Borrador',
            self::Scheduled => 'Programado',
            self::Published => 'Publicado',
            self::Archived => 'Archivado',
        };
    }
}
