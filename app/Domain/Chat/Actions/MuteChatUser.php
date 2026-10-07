<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Audit\AuditTrail;
use App\Models\ChatMute;
use App\Models\Station;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * The station team silences a listener in its chat for some minutes or
 * until it lifts the mute. Muting again replaces the term.
 */
final class MuteChatUser
{
    /** Terms the studio offers, in minutes; null silences until the team lifts it. */
    public const TERMS = [10, 60, 1440];

    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Station $station, User $listener, User $moderator, ?int $minutes): ChatMute
    {
        if ($listener->is($moderator)) {
            throw ValidationException::withMessages(['user_id' => 'No puedes silenciarte a ti mismo.']);
        }
        if ($listener->roleIn($station) !== null) {
            throw ValidationException::withMessages(['user_id' => 'No puedes silenciar a un miembro del equipo de la radio.']);
        }

        $mute = ChatMute::acrossStations()->updateOrCreate(
            ['station_id' => $station->id, 'user_id' => $listener->id],
            ['muted_by' => $moderator->id, 'until' => $minutes === null ? null : now()->addMinutes($minutes)],
        );

        $this->audit->record('chat.muted', $station, ['user_id' => $listener->id, 'minutes' => $minutes], $moderator, $station);

        return $mute;
    }
}
