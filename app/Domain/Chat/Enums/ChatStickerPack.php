<?php

namespace App\Domain\Chat\Enums;

/** The groups of the chat sticker picker, in the order the picker shows them. */
enum ChatStickerPack: string
{
    case Greetings = 'greetings';
    case Radio = 'radio';
    case Reactions = 'reactions';
    case Party = 'party';

    public function label(): string
    {
        return match ($this) {
            self::Greetings => 'Saludos',
            self::Radio => 'Cabina',
            self::Reactions => 'Reacciones',
            self::Party => 'Fiesta',
        };
    }
}
