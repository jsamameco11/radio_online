<?php

namespace App\Domain\Studio\Catalog;

enum ArtistKind: string
{
    case Solo = 'solo';
    case Group = 'group';

    public function label(): string
    {
        return match ($this) {
            self::Solo => 'Solista',
            self::Group => 'Agrupación',
        };
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(fn (self $kind) => ['value' => $kind->value, 'label' => $kind->label()], self::cases());
    }
}
