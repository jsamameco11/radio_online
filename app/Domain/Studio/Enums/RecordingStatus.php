<?php

namespace App\Domain\Studio\Enums;

/** Life of a console recording: captured in pieces, then kept as a library audio or discarded. */
enum RecordingStatus: string
{
    case Recording = 'recording';
    case Ready = 'ready';
    case Saving = 'saving';
    case Saved = 'saved';
    case Discarded = 'discarded';

    public function label(): string
    {
        return match ($this) {
            self::Recording => 'Grabando',
            self::Ready => 'Lista para guardar',
            self::Saving => 'Guardando',
            self::Saved => 'Guardada',
            self::Discarded => 'Descartada',
        };
    }

    /** The operator still has to save or discard it. */
    public function isOpen(): bool
    {
        return in_array($this, [self::Recording, self::Ready], true);
    }
}
