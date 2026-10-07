<?php

namespace App\Policies;

use App\Domain\Access\Enums\Permission;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Enums\StationRole;
use App\Models\StationMember;
use App\Models\User;

/**
 * Who may change or remove someone from a station team: whoever manages the
 * team of that station (or staff allowed into every studio), never on the
 * owner's own membership.
 */
class StationMemberPolicy
{
    public function update(User $user, StationMember $member): bool
    {
        return $this->managesTeam($user, $member) && $member->role !== StationRole::Owner;
    }

    public function delete(User $user, StationMember $member): bool
    {
        return $this->managesTeam($user, $member) && $member->role !== StationRole::Owner;
    }

    private function managesTeam(User $user, StationMember $member): bool
    {
        return $user->can(Permission::EnterAnyStudio->value)
            || $user->canInStation($member->station, StationPermission::ManageMembers);
    }
}
