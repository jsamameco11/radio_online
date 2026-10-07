<?php

namespace App\Domain\Streaming\Enums;

use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Stations\Enums\StationStatus;
use App\Models\Frequency;
use App\Models\Station;

/**
 * What a frequency of the dial looks like on the platform monitor: it
 * combines the frequency, the station on it and its broadcast state.
 */
enum MonitorStatus: string
{
    case Free = 'free';
    case Reserved = 'reserved';
    case Live = 'live';
    case Online = 'online';
    case Connecting = 'connecting';
    case Offline = 'offline';
    case Error = 'error';
    case Maintenance = 'maintenance';
    case Suspended = 'suspended';

    public function label(): string
    {
        return match ($this) {
            self::Free => 'Libre',
            self::Reserved => 'Reservada',
            self::Live => 'En vivo',
            self::Online => 'Al aire',
            self::Connecting => 'Conectando',
            self::Offline => 'Fuera del aire',
            self::Error => 'Con fallas',
            self::Maintenance => 'Mantenimiento',
            self::Suspended => 'Suspendida',
        };
    }

    public static function of(Frequency $frequency, ?Station $station): self
    {
        if ($frequency->status === FrequencyStatus::Maintenance) {
            return self::Maintenance;
        }

        if ($station === null) {
            return match ($frequency->status) {
                FrequencyStatus::Available => self::Free,
                FrequencyStatus::Suspended => self::Suspended,
                default => self::Reserved,
            };
        }

        if ($station->status === StationStatus::Suspended || $frequency->status === FrequencyStatus::Suspended) {
            return self::Suspended;
        }

        return match ($station->stream_status) {
            StreamStatus::Live => self::Live,
            StreamStatus::Online => self::Online,
            StreamStatus::Connecting => self::Connecting,
            StreamStatus::Error => self::Error,
            StreamStatus::Maintenance => self::Maintenance,
            StreamStatus::Offline => self::Offline,
        };
    }
}
