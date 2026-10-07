<?php

namespace App\Domain\Moderation\Enums;

enum ReportReason: string
{
    case Spam = 'spam';
    case Harassment = 'harassment';
    case HateSpeech = 'hate_speech';
    case Violence = 'violence';
    case SexualContent = 'sexual_content';
    case Copyright = 'copyright';
    case Misinformation = 'misinformation';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Spam => 'Spam o publicidad engañosa',
            self::Harassment => 'Acoso o intimidación',
            self::HateSpeech => 'Discurso de odio',
            self::Violence => 'Violencia',
            self::SexualContent => 'Contenido sexual',
            self::Copyright => 'Derechos de autor',
            self::Misinformation => 'Desinformación',
            self::Other => 'Otro motivo',
        };
    }
}
