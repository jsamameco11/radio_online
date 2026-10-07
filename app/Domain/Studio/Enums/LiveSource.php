<?php

namespace App\Domain\Studio\Enums;

/** Where the live signal comes from: the console microphone (WebRTC) or an external encoder (OBS / Icecast). */
enum LiveSource: string
{
    case Console = 'console';
    case External = 'external';

    public function label(): string
    {
        return match ($this) {
            self::Console => 'Consola del estudio',
            self::External => 'Señal externa (OBS / Icecast)',
        };
    }
}
