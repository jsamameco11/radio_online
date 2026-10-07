<?php

namespace App\Domain\Studio\Actions;

use App\Domain\Studio\Broadcast\BroadcastClock;
use App\Domain\Studio\Broadcast\BroadcastRejected;
use App\Domain\Studio\Broadcast\Schedule;
use App\Models\ScheduleSlot;

/**
 * Places blocks on a layer of the timeline one after another: at a time, after the last block of
 * the day («end») or right away («now»: on the main layer it cuts what is on air and pushes the
 * blocks that follow just enough to make room).
 */
final class PlaceBlocks
{
    public const AT = 'at';

    public const END = 'end';

    public const NOW = 'now';

    public function __construct(private readonly Schedule $schedule) {}

    /**
     * @param  list<array<string, mixed>>  $blocks
     * @return string what the team is told
     */
    public function handle(array $blocks, int $layer, string $date, string $mode, ?string $time = null): string
    {
        if ($mode === self::NOW && $layer === ScheduleSlot::MAIN) {
            $this->schedule->insertNow($blocks);

            return 'Al aire ahora. La programación siguiente se corrió para darle espacio.';
        }

        $start = $this->start($date, $mode, $layer, $time);
        $end = $start + Schedule::length($blocks);
        if ($conflict = $this->schedule->conflict($start, $end, $layer)) {
            throw new BroadcastRejected(Schedule::conflictMessage($conflict).' Elige otra hora, otra capa o mueve ese bloque.');
        }
        $this->schedule->place($blocks, $start);
        $count = count($blocks);
        $where = $layer === ScheduleSlot::MAIN ? '' : ' en la '.Schedule::layerLabel($layer);

        return ($count === 1 ? 'Bloque programado' : $count.' bloques programados').$where
            .' de '.BroadcastClock::clock($start).' a '.BroadcastClock::clock($end).'.';
    }

    /** When the blocks start (UTC ms); a past time is refused, except «end» today, which starts in a few seconds. */
    public function start(string $date, string $mode, int $layer, ?string $time): int
    {
        $now = BroadcastClock::nowMs();
        $start = match ($mode) {
            self::NOW => $now + 400,
            self::END => $this->schedule->dayEnd($date, $layer) ?? BroadcastClock::at($date, $time ?? '06:00'),
            default => BroadcastClock::at($date, (string) $time),
        };
        if ($start === null) {
            throw new BroadcastRejected('Escribe la hora de inicio (por ejemplo 18:30 o 18:30:15).');
        }
        if ($start < $now - 1000) {
            if ($mode !== self::END || $date !== BroadcastClock::today()) {
                throw new BroadcastRejected('Esa hora ya pasó. Elige una hora futura o usa «Al aire ahora».');
            }
            $start = $now + 3000;
        }

        return $start;
    }
}
