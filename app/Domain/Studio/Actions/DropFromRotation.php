<?php

namespace App\Domain\Studio\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Broadcast\Autopilot;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\Track;
use Illuminate\Support\Facades\DB;

/**
 * «No repetir» on the song the automatic music is playing: it leaves the rotation and every
 * playlist, so the automatic music does not pick it again. The answer is what the team is told.
 */
final class DropFromRotation
{
    public function __construct(
        private readonly StationBroadcast $broadcast,
        private readonly PlayoutCaches $caches,
        private readonly AuditTrail $audit,
        private readonly CurrentStation $current,
    ) {}

    public function handle(Track $track): string
    {
        $lists = DB::transaction(function () use ($track) {
            $track->update(['rotation' => false]);

            return $track->playlists()->detach();
        });
        $this->caches->flush();
        $this->audit->record('broadcast.rotation_dropped', $this->current->get(), ['track' => $track->id, 'title' => $track->title, 'playlists' => $lists]);
        $autopilot = $this->broadcast->autopilot();

        return "«{$track->title}» salió de la música automática"
            .($lists ? ' (y de '.($lists === 1 ? 'su lista' : "sus {$lists} listas").')' : '').' y no se repetirá.'
            .match ($autopilot['level']) {
                Autopilot::NONE => ' «'.$autopilot['label'].'» quedó sin canciones: los espacios libres estarán en silencio.',
                Autopilot::LIBRARY => ' Tus listas quedaron vacías: las canciones aleatorias salen de toda la biblioteca.',
                default => '',
            };
    }
}
