<?php

namespace App\Domain\Applications\Enums;

/** Identity documents an applicant may present. Numbers are normalized (uppercase, no spaces, dots or dashes) before matching pattern(). */
enum DocumentType: string
{
    case Dni = 'dni';
    case ForeignerCard = 'foreigner_card';
    case IdentityCard = 'identity_card';
    case Passport = 'passport';

    public function label(): string
    {
        return match ($this) {
            self::Dni => 'DNI',
            self::ForeignerCard => 'Carné de extranjería',
            self::IdentityCard => 'Cédula de identidad',
            self::Passport => 'Pasaporte',
        };
    }

    /** Regular expression (PHP and JavaScript compatible) the normalized number must match. */
    public function pattern(): string
    {
        return match ($this) {
            self::Dni => '^[0-9]{8}$',
            self::ForeignerCard => '^[A-Z0-9]{8,12}$',
            self::IdentityCard => '^[A-Z0-9]{5,15}$',
            self::Passport => '^[A-Z0-9]{6,12}$',
        };
    }

    public function hint(): string
    {
        return match ($this) {
            self::Dni => '8 dígitos.',
            self::ForeignerCard => 'Entre 8 y 12 letras o números.',
            self::IdentityCard => 'Entre 5 y 15 letras o números.',
            self::Passport => 'Entre 6 y 12 letras o números.',
        };
    }

    public static function normalize(string $number): string
    {
        return strtoupper((string) preg_replace('/[\s.\-]+/', '', $number));
    }
}
