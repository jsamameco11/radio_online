<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Audit\AuditTrail;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\PermissionRegistrar;

/**
 * Sets the platform role of an account. Nobody changes their own role, only
 * a super administrator grants or removes super administration, and the
 * platform always keeps at least one super administrator.
 */
final class ChangePlatformRole
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(User $target, PlatformRole $role, User $actor): User
    {
        if ($target->is($actor)) {
            throw ValidationException::withMessages(['role' => 'No puedes cambiar tu propio rol.']);
        }

        if (($role === PlatformRole::SuperAdmin || $target->isSuperAdmin()) && ! $actor->isSuperAdmin()) {
            throw ValidationException::withMessages(['role' => 'Solo un superadministrador puede otorgar o retirar ese rol.']);
        }

        $previous = $target->getRoleNames()->values()->all();

        if ($target->isSuperAdmin() && $role !== PlatformRole::SuperAdmin && User::role(PlatformRole::SuperAdmin->value)->count() <= 1) {
            throw ValidationException::withMessages(['role' => 'La plataforma necesita al menos un superadministrador.']);
        }

        $target->syncRoles([$role->value]);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->audit->record('user.role_changed', $target, ['from' => $previous, 'to' => $role->value], $actor);

        return $target;
    }
}
