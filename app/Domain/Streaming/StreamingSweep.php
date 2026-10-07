<?php

namespace App\Domain\Streaming;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Models\Station;

/**
 * The minute-by-minute housekeeping of every station's broadcast: listener sessions whose player
 * stopped beating end, forgotten microphone handshakes go, and each station that shows itself on
 * the air is brought back in line with its engine (a console that vanished ends its live session,
 * a station that can no longer sound goes offline).
 */
final class StreamingSweep
{
    public function __construct(
        private readonly CurrentStation $current,
        private readonly Audience $audience,
    ) {}

    /** @return array{sessions: int, peers: int, stations: int} */
    public function handle(): array
    {
        $sessions = $this->audience->sweep();
        $peers = VoiceSignal::prune();
        $stations = Station::query()->with('frequency')->where('stream_status', '!=', StreamStatus::Offline->value)->get();
        foreach ($stations as $station) {
            $this->current->within($station, function () {
                $broadcast = app(StationBroadcast::class);
                $broadcast->live();
                $broadcast->syncPresence();
            });
        }

        return ['sessions' => $sessions, 'peers' => $peers, 'stations' => $stations->count()];
    }
}
