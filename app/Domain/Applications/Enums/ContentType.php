<?php

namespace App\Domain\Applications\Enums;

/** What a future station plans to broadcast; an application declares one or more. */
enum ContentType: string
{
    case Music = 'music';
    case News = 'news';
    case Sports = 'sports';
    case Interviews = 'interviews';
    case Educational = 'educational';
    case Religious = 'religious';
    case Cultural = 'cultural';
    case Entertainment = 'entertainment';
    case Podcast = 'podcast';
    case Community = 'community';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Music => 'Música',
            self::News => 'Noticias',
            self::Sports => 'Deportes',
            self::Interviews => 'Entrevistas',
            self::Educational => 'Educativo',
            self::Religious => 'Religioso',
            self::Cultural => 'Cultural',
            self::Entertainment => 'Entretenimiento',
            self::Podcast => 'Pódcast',
            self::Community => 'Comunidad',
            self::Other => 'Otro',
        };
    }
}
