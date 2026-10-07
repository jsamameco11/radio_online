<?php

namespace App\Domain\Streaming\Enums;

/**
 * Broadcast state of a station as listeners and the monitor see it.
 *
 * Live: a host is on air from the console or an external encoder.
 * Online: the automation is playing the programming without a host.
 */
enum StreamStatus: string
{
    case Live = 'live';
    case Online = 'online';
    case Connecting = 'connecting';
    case Offline = 'offline';
    case Error = 'error';
    case Maintenance = 'maintenance';

    public function label(): string
    {
        return match ($this) {
            self::Live => 'En vivo',
            self::Online => 'Al aire',
            self::Connecting => 'Conectando',
            self::Offline => 'Fuera del aire',
            self::Error => 'Con fallas',
            self::Maintenance => 'Mantenimiento',
        };
    }

    public function isAudible(): bool
    {
        return in_array($this, [self::Live, self::Online], true);
    }
}
