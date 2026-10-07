<?php

namespace App\Domain\Studio\Editor;

/** State of the edit of a library audio while (or after) the server renders it. */
enum EditStatus: string
{
    case Processing = 'processing';
    case Failed = 'failed';

    public function label(): string
    {
        return match ($this) {
            self::Processing => 'Procesando',
            self::Failed => 'Falló',
        };
    }
}
