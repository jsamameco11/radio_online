<?php

namespace App\Domain\Studio\Library;

use App\Domain\Access\Enums\Permission;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use App\Models\User;

/** Checks inside a studio request that go further than the route's permission middleware. */
final class StudioAccess
{
    public function __construct(private readonly CurrentStation $current) {}

    public function allows(User $user, StationPermission $permission): bool
    {
        return $user->can(Permission::EnterAnyStudio->value) || $user->canInStation($this->current->get(), $permission);
    }

    public function authorize(User $user, StationPermission $permission): void
    {
        abort_unless($this->allows($user, $permission), 403);
    }
}
