<?php

namespace App\Domain\Chat;

use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Models\ChatMute;
use App\Models\Station;
use App\Models\StreamSession;
use App\Models\User;
use Carbon\CarbonInterface;

/**
 * The state of a station's chat: it is open while a host is live on an
 * active station, belongs to the live transmission on air, and keeps who
 * the team silenced.
 */
final class ChatRoom
{
    public function isOpen(Station $station): bool
    {
        return $station->status === StationStatus::Active
            && ! $station->trashed()
            && $station->stream_status === StreamStatus::Live;
    }

    /** The live transmission on air, if any. */
    public function session(Station $station): ?StreamSession
    {
        return StreamSession::acrossStations()
            ->where('station_id', $station->id)
            ->whereNull('ended_at')
            ->latest('started_at')
            ->first();
    }

    /** The live transmission on air, or the last one the station had. */
    public function latestSession(Station $station): ?StreamSession
    {
        return $this->session($station) ?? StreamSession::acrossStations()
            ->where('station_id', $station->id)
            ->latest('started_at')
            ->first();
    }

    /** Messages written since this moment belong to the chat on air. */
    public function openedAt(Station $station): ?CarbonInterface
    {
        return $this->isOpen($station) ? ($station->went_live_at ?? $this->session($station)?->started_at) : null;
    }

    public function mute(Station $station, User $user): ?ChatMute
    {
        return ChatMute::acrossStations()
            ->where('station_id', $station->id)
            ->where('user_id', $user->id)
            ->active()
            ->first();
    }
}
