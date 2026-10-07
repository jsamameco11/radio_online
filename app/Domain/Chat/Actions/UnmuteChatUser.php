<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Audit\AuditTrail;
use App\Models\ChatMute;
use App\Models\Station;
use App\Models\User;

/** The station team lets a silenced listener write in its chat again. */
final class UnmuteChatUser
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Station $station, User $listener, User $moderator): void
    {
        $lifted = ChatMute::acrossStations()->where('station_id', $station->id)->where('user_id', $listener->id)->delete();

        if ($lifted > 0) {
            $this->audit->record('chat.unmuted', $station, ['user_id' => $listener->id], $moderator, $station);
        }
    }
}
