<?php

namespace App\Domain\Growth\Enums;

/** What a growth goal measures. */
enum GoalMetric: string
{
    case Episodes = 'episodes';
    case Lives = 'lives';
    case Streak = 'streak';
    case Subscribers = 'subscribers';
    case LivePeak = 'live_peak';

    public function label(): string
    {
        return match ($this) {
            self::Episodes => 'Episodios publicados',
            self::Lives => 'Transmisiones en vivo',
            self::Streak => 'Días seguidos',
            self::Subscribers => 'Suscriptores',
            self::LivePeak => 'Oyentes en vivo a la vez',
        };
    }
}
