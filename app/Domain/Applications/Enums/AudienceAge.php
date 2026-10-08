<?php

namespace App\Domain\Applications\Enums;

/** Age ranges a future station speaks to; "all ages" excludes the rest. */
enum AudienceAge: string
{
    case Children = 'children';
    case Teens = 'teens';
    case Young = 'young';
    case YoungAdults = 'young_adults';
    case Adults = 'adults';
    case MatureAdults = 'mature_adults';
    case Seniors = 'seniors';
    case AllAges = 'all_ages';

    public function label(): string
    {
        return match ($this) {
            self::Children => 'Niños (0 a 12)',
            self::Teens => 'Adolescentes (13 a 17)',
            self::Young => 'Jóvenes (18 a 24)',
            self::YoungAdults => 'Adultos jóvenes (25 a 34)',
            self::Adults => 'Adultos (35 a 49)',
            self::MatureAdults => 'Adultos maduros (50 a 64)',
            self::Seniors => 'Adultos mayores (65 o más)',
            self::AllAges => 'Todas las edades',
        };
    }
}
