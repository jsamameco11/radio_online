<?php

namespace App\Domain\Studio\Enums;

/**
 * What an audio of a station library is, which decides where it can be used.
 */
enum TrackKind: string
{
    case Song = 'song';
    case Jingle = 'jingle';
    case Effect = 'effect';
    case Commercial = 'commercial';
    case Program = 'program';

    public function label(): string
    {
        return match ($this) {
            self::Song => 'Canción',
            self::Jingle => 'Jingle',
            self::Effect => 'Efecto',
            self::Commercial => 'Comercial',
            self::Program => 'Programa grabado',
        };
    }

    /** Spoken audio lowers the music underneath by default when it plays on top of it. */
    public function ducksByDefault(): bool
    {
        return in_array($this, [self::Commercial, self::Program], true);
    }
}
