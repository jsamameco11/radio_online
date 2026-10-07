<?php

namespace App\Domain\Studio\Actions;

use App\Domain\Studio\Broadcast\Autopilot;
use App\Domain\Studio\Broadcast\BroadcastClock;
use App\Domain\Studio\Broadcast\BroadcastRejected;
use App\Domain\Studio\Broadcast\ProgramEngine;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Models\Playlist;

/**
 * «Iniciar modo automático»: the chosen list (or random songs) starts for every listener in a few
 * seconds, from the chosen song, with the radio on air and the continuous music on.
 */
final class StartAutomaticMusic
{
    public function __construct(
        private readonly StationBroadcast $broadcast,
        private readonly Autopilot $autopilot,
    ) {}

    /** @return string what the team is told */
    public function handle(?Playlist $playlist, bool $shuffle, ?string $first, ?bool $repeat): string
    {
        $source = $this->autopilot->resolve($playlist?->id, $shuffle, ProgramEngine::crossfadeMs($this->broadcast->config()));
        if ($source['level'] === Autopilot::NONE) {
            throw new BroadcastRejected(self::withoutSongs($playlist), 409);
        }
        $chosen = null;
        if ($first !== null) {
            $chosen = collect($source['songs'])->firstWhere('id', $first);
            if ($chosen === null) {
                throw new BroadcastRejected('Esa canción no está disponible en '.($playlist ? 'la lista «'.$playlist->name.'»' : 'la música automática').'. Elige otra.');
            }
        }

        $since = $this->broadcast->startAutopilot($playlist?->id, $shuffle, $chosen['id'] ?? null, $repeat);
        $what = $playlist ? 'la lista «'.$playlist->name.'» ('.($shuffle ? 'aleatorio' : 'en orden').')' : 'canciones aleatorias';
        $song = $this->broadcast->firstSong($since);
        $message = $song
            ? "Modo automático iniciado: «{$song['title']}» de {$what} empieza para todos los oyentes en unos segundos."
            : "Modo automático listo: {$what} empezará".($chosen ? " con «{$chosen['title']}»" : '').' cuando termine lo que está programado ahora.';
        $until = $this->broadcast->autopilot()['until'];
        if ($until !== null) {
            $message .= ' Sin repetir: suena una vez y a las '.BroadcastClock::clock($until).' la radio queda en silencio.';
        }

        return $message;
    }

    public static function withoutSongs(?Playlist $playlist): string
    {
        return $playlist
            ? 'La lista «'.$playlist->name.'» no tiene canciones disponibles. Agrégale canciones en Listas o elige otra.'
            : 'No hay canciones disponibles para el modo automático. Sube música a la biblioteca.';
    }
}
