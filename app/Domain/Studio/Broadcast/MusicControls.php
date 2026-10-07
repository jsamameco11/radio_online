<?php

namespace App\Domain\Studio\Broadcast;

/**
 * The switches of the automatic music: on or off (off, only what is scheduled or launched sounds),
 * «Repetir», and calling off a pending change of source. Each one answers what the team is told.
 */
final class MusicControls
{
    public function __construct(private readonly StationBroadcast $broadcast) {}

    public function autofill(bool $on): string
    {
        $this->broadcast->saveConfig(['autofill' => $on]);
        if (! $on) {
            return 'Modo automático detenido: solo suena lo programado y lo que lances desde la consola; lo demás es silencio.';
        }
        $autopilot = $this->broadcast->autopilot();
        if ($autopilot['level'] === Autopilot::NONE) {
            return 'Modo automático activado, pero «'.$autopilot['label'].'» no tiene canciones disponibles: seguirá en silencio hasta que le agregues canciones.';
        }

        return 'Modo automático activado: «'.$autopilot['label'].'» llena los espacios libres.'
            .($autopilot['finished'] ? ' Ya sonó completa y «Repetir» está apagado: activa «Repetir» o inicia de nuevo para volver a escucharla.' : '');
    }

    public function repeat(bool $repeat): string
    {
        $this->broadcast->setRepeat($repeat);
        $autopilot = $this->broadcast->autopilot();
        if ($repeat) {
            return 'Repetir activado: «'.$autopilot['label'].'» vuelve a empezar cuando termina.';
        }

        return $autopilot['until'] !== null
            ? 'Repetir apagado: «'.$autopilot['label'].'» termina a las '.BroadcastClock::clock($autopilot['until']).' y luego la radio queda en silencio.'
            : 'Repetir apagado: «'.$autopilot['label'].'» sonará una sola vez y luego la radio quedará en silencio.';
    }

    public function cancelSwitch(): string
    {
        $cancelled = $this->broadcast->cancelAutopilotSwitch();
        $label = $this->broadcast->autopilot()['label'];

        return $cancelled ? "Cambio cancelado: sigue sonando {$label}." : "No había un cambio pendiente: ya está sonando {$label}.";
    }
}
