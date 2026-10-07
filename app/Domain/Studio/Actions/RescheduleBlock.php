<?php

namespace App\Domain\Studio\Actions;

use App\Domain\Studio\Broadcast\BroadcastClock;
use App\Domain\Studio\Broadcast\BroadcastRejected;
use App\Domain\Studio\Broadcast\Schedule;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Models\ScheduleSlot;
use Carbon\CarbonImmutable;

/**
 * Reprograms a block of the main program from the console's warning: a few minutes later or at
 * another time. While the live transmission lasts, audios still wait for it to end.
 */
final class RescheduleBlock
{
    public function __construct(
        private readonly Schedule $schedule,
        private readonly StationBroadcast $broadcast,
    ) {}

    /** @return string what the team is told */
    public function handle(ScheduleSlot $slot, ?int $minutes, ?string $date, ?string $time): string
    {
        if ($slot->layer !== ScheduleSlot::MAIN) {
            throw new BroadcastRejected('Solo se reprograman bloques de la pista principal desde la consola.');
        }
        $now = BroadcastClock::nowMs();
        $start = $minutes !== null
            ? max($slot->starts_at->getTimestampMs(), $now) + $minutes * 60000
            : BroadcastClock::at($date ?? BroadcastClock::today(), (string) $time);
        if ($start === null) {
            throw new BroadcastRejected('Escribe la nueva hora (por ejemplo 18:30).');
        }
        if ($start < $now + 1000) {
            throw new BroadcastRejected('Esa hora ya pasó. Elige una hora futura.');
        }
        $end = $start + (int) round($slot->duration * 1000);
        if ($conflict = $this->schedule->conflict($start, $end, ScheduleSlot::MAIN, $slot->id)) {
            throw new BroadcastRejected(Schedule::conflictMessage($conflict).' Elige otra hora.');
        }
        $slot->update(['starts_at' => BroadcastClock::utc($start)]);
        $this->schedule->flush();

        $day = CarbonImmutable::createFromTimestampMs($start)->setTimezone(BroadcastClock::timezone());
        $when = 'las '.$day->format('H:i').($day->toDateString() === BroadcastClock::today() ? '' : ' del '.$day->format('d/m'));
        $waits = $this->broadcast->holding() && ! in_array($slot->kind, [ScheduleSlot::LIVE, ScheduleSlot::AUTO], true);

        return '«'.$slot->title.'» quedó para '.$when.'.'
            .($waits ? ' Si a esa hora sigues en vivo, esperará a que termines la transmisión.' : '');
    }
}
