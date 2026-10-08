<?php

namespace App\Domain\Stories\Enums;

/** Backdrops of a text story; the frontend paints each one from the design tokens. */
enum StoryBackground: string
{
    case Signal = 'signal';
    case Royal = 'royal';
    case Ocean = 'ocean';
    case Aurora = 'aurora';
    case Sunset = 'sunset';
    case Night = 'night';

    public function label(): string
    {
        return match ($this) {
            self::Signal => 'Al aire',
            self::Royal => 'Violeta',
            self::Ocean => 'Océano',
            self::Aurora => 'Aurora',
            self::Sunset => 'Atardecer',
            self::Night => 'Noche',
        };
    }
}
