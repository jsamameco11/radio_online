<?php

namespace App\Domain\Studio\Library;

/** What is wrong with the file of a library audio; an audio with a problem never plays on air. */
enum FileProblem: string
{
    case Missing = 'missing';
    case Empty = 'empty';

    public function label(): string
    {
        return match ($this) {
            self::Missing => 'El archivo no está en el almacenamiento',
            self::Empty => 'El archivo está vacío',
        };
    }
}
