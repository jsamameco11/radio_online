<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Enums\StationRole;
use App\Models\Station;
use App\Models\StationMember;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/** Gives a team member another role. The owner's role only changes through a transfer. */
final class ChangeMemberRole
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Station $station, StationMember $member, StationRole $role, User $actor): StationMember
    {
        if ($member->role === StationRole::Owner || $role === StationRole::Owner) {
            throw ValidationException::withMessages(['role' => 'La propiedad de la emisora solo cambia con una transferencia.']);
        }

        if ($member->role === $role) {
            return $member;
        }

        $previous = $member->role;
        $member->update(['role' => $role]);

        $this->audit->record('station.member_role_changed', $station, [
            'user_id' => $member->user_id,
            'from' => $previous->value,
            'to' => $role->value,
        ], $actor);

        return $member;
    }
}
