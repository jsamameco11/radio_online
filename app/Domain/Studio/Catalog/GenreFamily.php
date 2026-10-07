<?php

namespace App\Domain\Studio\Catalog;

/**
 * The families the genres of the music catalog are grouped in.
 */
enum GenreFamily: string
{
    case Pop = 'pop';
    case Rock = 'rock';
    case Metal = 'metal';
    case Urban = 'urban';
    case Electronic = 'electronic';
    case Tropical = 'tropical';
    case Regional = 'regional';
    case Latin = 'latin';
    case Jazz = 'jazz';
    case Classical = 'classical';
    case Christian = 'christian';
    case World = 'world';

    public function label(): string
    {
        return match ($this) {
            self::Pop => 'Pop',
            self::Rock => 'Rock',
            self::Metal => 'Metal y punk',
            self::Urban => 'Urbano y hip hop',
            self::Electronic => 'Electrónica',
            self::Tropical => 'Tropical y caribeña',
            self::Regional => 'Regional mexicano',
            self::Latin => 'Latinoamericana y folclore',
            self::Jazz => 'Jazz, blues y soul',
            self::Classical => 'Clásica e instrumental',
            self::Christian => 'Música cristiana',
            self::World => 'Del mundo y otros',
        };
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(fn (self $family) => ['value' => $family->value, 'label' => $family->label()], self::cases());
    }
}
