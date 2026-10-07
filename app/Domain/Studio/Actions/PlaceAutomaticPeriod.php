<?php

namespace App\Domain\Studio\Actions;

use App\Domain\Studio\Broadcast\BroadcastClock;
use App\Domain\Studio\Broadcast\BroadcastRejected;
use App\Domain\Studio\Broadcast\Schedule;
use App\Models\Playlist;
use App\Models\ScheduleSlot;

/** «Música automática» from one time to another: a period of the main program for a playlist (or random songs). */
final class PlaceAutomaticPeriod
{
    public function __construct(
        private readonly Schedule $schedule,
        private readonly PlaceBlocks $blocks,
    ) {}

    /** @return string what the team is told */
    public function handle(?Playlist $playlist, bool $shuffle, string $date, string $mode, ?string $time, string $until, ?string $note): string
    {
        $start = $this->blocks->start($date, $mode, ScheduleSlot::MAIN, $time);
        $end = BroadcastClock::at($date, $until);
        if ($end === null) {
            throw new BroadcastRejected('Escribe la hora en que termina la música automática (por ejemplo 18:00).');
        }
        while ($end <= $start) {
            $end += 86400000;
        }
        $seconds = intdiv($end - $start, 1000);
        if ($seconds < 60 || $seconds > 86400) {
            throw new BroadcastRejected('Un periodo de música automática dura entre 1 minuto y 24 horas.');
        }
        if ($conflict = $this->schedule->conflict($start, $end)) {
            throw new BroadcastRejected(Schedule::conflictMessage($conflict).' Ajusta el periodo o mueve ese bloque.');
        }
        $this->schedule->place(Schedule::autoBlocks($playlist, $shuffle, $seconds, $note), $start);

        return 'Música automática de '.BroadcastClock::clock($start).' a '.BroadcastClock::clock($end).': '
            .($playlist ? 'lista «'.$playlist->name.'», '.($shuffle ? 'en aleatorio sin repetir' : 'en orden') : 'canciones aleatorias').'.';
    }
}
