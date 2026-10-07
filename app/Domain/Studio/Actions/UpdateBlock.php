<?php

namespace App\Domain\Studio\Actions;

use App\Domain\Studio\Broadcast\BroadcastClock;
use App\Domain\Studio\Broadcast\BroadcastRejected;
use App\Domain\Studio\Broadcast\Schedule;
use App\Domain\Studio\Broadcast\Timeline;
use App\Models\Playlist;
use App\Models\ScheduleSlot;

/**
 * Edits a block of the timeline: its time, title and note, and what its kind allows (length and
 * music bed of a live block; playlist, order and end of an automatic period; layer, ducking and
 * volume of an audio).
 */
final class UpdateBlock
{
    public function __construct(private readonly Schedule $schedule) {}

    /**
     * @param  array{date?: ?string, time?: ?string, title?: ?string, note?: ?string, minutes?: ?float, bed?: bool, playlist?: ?Playlist, shuffle?: bool, until?: ?string, layer?: ?int, duck?: bool, volume?: ?int}  $data
     */
    public function handle(ScheduleSlot $slot, array $data): void
    {
        $date = $data['date'] ?? BroadcastClock::localDay($slot->starts_at->getTimestampMs());
        $start = ! empty($data['time']) ? BroadcastClock::at($date, $data['time']) : $slot->starts_at->getTimestampMs();
        if ($start === null) {
            throw new BroadcastRejected('Escribe una hora válida (por ejemplo 18:30 o 18:30:15).');
        }

        $changes = ['starts_at' => BroadcastClock::utc($start), 'note' => $data['note'] ?? null];
        if (! empty($data['title'])) {
            $changes['title'] = $data['title'];
        }
        if ($slot->kind === ScheduleSlot::LIVE) {
            $minutes = (float) ($data['minutes'] ?? $slot->duration / 60);
            if ($minutes < 1 || $minutes > Timeline::MAX_BLOCK / 60) {
                throw new BroadcastRejected('Un bloque en vivo dura entre 1 minuto y 6 horas.');
            }
            $changes['duration'] = round($minutes * 60, 2);
            $changes['bed'] = (bool) ($data['bed'] ?? $slot->bed);
        } elseif ($slot->kind === ScheduleSlot::AUTO) {
            $playlist = array_key_exists('playlist', $data) ? $data['playlist'] : $slot->playlist;
            $until = ! empty($data['until']) ? BroadcastClock::at($date, $data['until']) : $slot->endsAt()->getTimestampMs();
            if ($until === null) {
                throw new BroadcastRejected('Escribe la hora en que termina (por ejemplo 18:00).');
            }
            $until += $until <= $start ? 86400000 : 0;
            $seconds = ($until - $start) / 1000;
            if ($seconds < 60 || $seconds > Timeline::MAX_BLOCK) {
                throw new BroadcastRejected('Al editar, un periodo dura entre 1 minuto y 6 horas. Para uno más largo, quítalo y prográmalo de nuevo.');
            }
            $shuffle = $playlist === null || (bool) ($data['shuffle'] ?? $slot->shuffle);
            $changes = [
                ...$changes,
                'duration' => round($seconds, 2),
                'playlist_id' => $playlist?->id,
                'shuffle' => $shuffle,
                'title' => Schedule::autoTitle($playlist, $shuffle),
            ];
        } else {
            $layer = $data['layer'] ?? $slot->layer;
            $changes['layer'] = $layer;
            $changes['duck'] = $layer !== ScheduleSlot::MAIN && (bool) ($data['duck'] ?? $slot->duck);
            $changes['volume'] = $layer === ScheduleSlot::MAIN ? 100 : max(0, min(100, (int) ($data['volume'] ?? $slot->volume)));
        }

        $end = $start + (int) round(($changes['duration'] ?? $slot->duration) * 1000);
        if ($conflict = $this->schedule->conflict($start, $end, $changes['layer'] ?? $slot->layer, $slot->id)) {
            throw new BroadcastRejected(Schedule::conflictMessage($conflict).' Elige otra hora.');
        }
        $slot->update($changes);
        $this->schedule->flush();
    }
}
