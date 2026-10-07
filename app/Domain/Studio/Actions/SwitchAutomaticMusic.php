<?php

namespace App\Domain\Studio\Actions;

use App\Domain\Studio\Broadcast\Autopilot;
use App\Domain\Studio\Broadcast\BroadcastClock;
use App\Domain\Studio\Broadcast\BroadcastRejected;
use App\Domain\Studio\Broadcast\ProgramEngine;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Models\Playlist;

/**
 * Switches the automatic music to another source (a list or random songs) without cutting a song:
 * when the song on air ends (the default), at a song boundary the operator chose ($at, one of
 * StationBroadcast::switchPoints()) or at once.
 */
final class SwitchAutomaticMusic
{
    public function __construct(
        private readonly StationBroadcast $broadcast,
        private readonly Autopilot $autopilot,
    ) {}

    /** @return string what the team is told */
    public function handle(?Playlist $playlist, bool $shuffle, bool $immediately = false, ?int $at = null): string
    {
        if ($this->autopilot->resolve($playlist?->id, $shuffle, ProgramEngine::crossfadeMs($this->broadcast->config()))['level'] === Autopilot::NONE) {
            throw new BroadcastRejected(StartAutomaticMusic::withoutSongs($playlist), 409);
        }
        $points = $immediately ? [] : $this->broadcast->switchPoints();
        $chosen = null;
        if (! $immediately && $at !== null) {
            $chosen = collect($points)->first(fn (array $point) => abs($point['at'] - $at) <= 2000);
            if ($chosen === null) {
                throw new BroadcastRejected('Ese punto de cambio ya pasó o la programación cambió. Vuelve a elegir dónde hacer el cambio.', 409);
            }
        }

        $since = $this->broadcast->switchAutopilot($playlist?->id, $shuffle, $immediately, $chosen['at'] ?? null);
        $what = $playlist !== null ? 'lista «'.$playlist->name.'» '.($shuffle ? 'en aleatorio' : 'en orden') : 'canciones aleatorias';
        if ($since <= BroadcastClock::nowMs() + 1000) {
            return "Música automática: {$what}. Ya está sonando.";
        }
        $after = collect($points)->firstWhere('at', $since)['after'] ?? null;
        $when = $after ? 'cuando termina «'.$after['title'].'»' : 'cuando termina lo que suena';
        $pending = $this->broadcast->autopilot()['pending'];

        return "Cambio programado: {$what} empieza a las ".BroadcastClock::clock($since).", {$when}, sin cortes."
            .($pending ? ' Hasta entonces sigue '.$pending['label'].'. Puedes cancelarlo antes.' : '');
    }
}
