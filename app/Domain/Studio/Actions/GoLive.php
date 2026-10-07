<?php

namespace App\Domain\Studio\Actions;

use App\Domain\Studio\Broadcast\BroadcastRejected;
use App\Domain\Studio\Broadcast\LiveSwitch;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Domain\Studio\Enums\LiveSource;

/** «Ir al vivo»: cuts the automatic music for the live signal (the console microphone or the external encoder). */
final class GoLive
{
    public function __construct(
        private readonly StationBroadcast $broadcast,
        private readonly LiveSwitch $switch,
    ) {}

    /** @return string what the team is told */
    public function handle(): string
    {
        $config = $this->broadcast->config();
        if (! $config['on_air']) {
            throw new BroadcastRejected('La radio está fuera del aire. Ponla al aire primero.', 409);
        }
        $external = $config['live_source'] === LiveSource::External->value;
        if ($external && $config['live_url'] === '') {
            throw new BroadcastRejected('Falta el enlace de la señal externa. Escríbelo en Configuración › Transmisión.', 409);
        }
        $live = $this->broadcast->live();
        if (! $external && ! $live['session']) {
            throw new BroadcastRejected('Abre la transmisión en vivo (micrófono) antes de cortar la música.', 409);
        }
        $this->switch->cut($live['title'] ?: 'En vivo');
        $this->broadcast->syncPresence();

        return $external
            ? 'Al aire la señal externa: la música automática se cortó para todos los oyentes.'
            : 'Estás al aire: la música automática se cortó para todos los oyentes.';
    }
}
