<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Enums\StationRole;
use App\Models\Station;
use App\Models\StationMember;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/** Takes someone off the station team. The owner cannot be removed. */
final class RemoveStationMember
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Station $station, StationMember $member, User $actor): void
    {
        if ($member->role === StationRole::Owner) {
            throw ValidationException::withMessages(['member' => 'No puedes quitar al propietario de la emisora.']);
        }

        $member->delete();

        $this->audit->record('station.member_removed', $station, ['user_id' => $member->user_id, 'role' => $member->role->value], $actor);
    }
}
