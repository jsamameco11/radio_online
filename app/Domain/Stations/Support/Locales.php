<?php

namespace App\Domain\Stations\Support;

/** Languages and countries a station can declare, with their Spanish names. */
final class Locales
{
    public const LANGUAGES = [
        'es' => 'Español',
        'en' => 'Inglés',
        'pt' => 'Portugués',
        'qu' => 'Quechua',
        'ay' => 'Aimara',
        'gn' => 'Guaraní',
        'fr' => 'Francés',
        'it' => 'Italiano',
        'de' => 'Alemán',
    ];

    public const COUNTRIES = [
        'PE' => 'Perú',
        'AR' => 'Argentina',
        'BO' => 'Bolivia',
        'BR' => 'Brasil',
        'CL' => 'Chile',
        'CO' => 'Colombia',
        'CR' => 'Costa Rica',
        'CU' => 'Cuba',
        'DO' => 'República Dominicana',
        'EC' => 'Ecuador',
        'SV' => 'El Salvador',
        'ES' => 'España',
        'US' => 'Estados Unidos',
        'GT' => 'Guatemala',
        'HN' => 'Honduras',
        'MX' => 'México',
        'NI' => 'Nicaragua',
        'PA' => 'Panamá',
        'PY' => 'Paraguay',
        'PR' => 'Puerto Rico',
        'UY' => 'Uruguay',
        'VE' => 'Venezuela',
        'CA' => 'Canadá',
        'IT' => 'Italia',
        'JP' => 'Japón',
        'GB' => 'Reino Unido',
        'DE' => 'Alemania',
        'FR' => 'Francia',
    ];

    /**
     * @param  array<string, string>  $list
     * @return list<array{value: string, label: string}>
     */
    public static function options(array $list): array
    {
        return array_map(fn (string $value, string $label) => ['value' => $value, 'label' => $label], array_keys($list), $list);
    }
}
