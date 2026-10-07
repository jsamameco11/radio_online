<?php

namespace App\Domain\Studio\Enums;

/**
 * Who moves the live switch. Automatic: a scheduled live block cuts the music
 * by itself while the host is connected. Manual: only the operator does.
 */
enum LiveMode: string
{
    case Auto = 'auto';
    case Manual = 'manual';

    public function label(): string
    {
        return match ($this) {
            self::Auto => 'Automático',
            self::Manual => 'Manual',
        };
    }
}
