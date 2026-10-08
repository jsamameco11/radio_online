<?php

namespace App\Domain\Stories\Enums;

enum StoryKind: string
{
    case Image = 'image';
    case Video = 'video';
    case Text = 'text';

    public function label(): string
    {
        return match ($this) {
            self::Image => 'Foto',
            self::Video => 'Video',
            self::Text => 'Texto',
        };
    }

    public function hasMedia(): bool
    {
        return $this !== self::Text;
    }
}
