<?php

namespace App\Domain\Applications\Enums;

/** Families of audience tags, in the order the form shows them. */
enum AudienceGroup: string
{
    case Profile = 'profile';
    case LifeStage = 'life_stage';
    case Faith = 'faith';
    case Identity = 'identity';
    case Place = 'place';
    case Music = 'music';
    case Interests = 'interests';

    public function label(): string
    {
        return match ($this) {
            self::Profile => 'Perfil y ocupación',
            self::LifeStage => 'Familia y etapa de vida',
            self::Faith => 'Fe y espiritualidad',
            self::Identity => 'Comunidad e identidad',
            self::Place => 'Lugar y alcance',
            self::Music => 'Gustos musicales',
            self::Interests => 'Intereses y temas',
        };
    }
}
