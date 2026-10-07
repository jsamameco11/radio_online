<?php

namespace App\Domain\Access\Actions;

use App\Domain\Audit\AuditTrail;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Gives a staff account the username and password it signs in to the control panel with.
 * Only a super administrator sets them for another super administrator.
 */
final class SetStaffCredentials
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(User $target, string $username, ?string $password, User $actor): User
    {
        if (! $target->isStaff()) {
            throw ValidationException::withMessages(['username' => 'Primero dale un rol del personal de la plataforma.']);
        }

        if ($target->isSuperAdmin() && ! $actor->isSuperAdmin()) {
            throw ValidationException::withMessages(['username' => 'Solo un superadministrador puede cambiar el acceso de otro superadministrador.']);
        }

        $changed = array_keys(array_filter([
            'username' => $target->username !== $username,
            'password' => $password !== null,
        ]));

        $target->forceFill(['username' => $username]);
        if ($password !== null) {
            $target->forceFill(['password' => $password]);
        }
        $target->save();

        $this->audit->record('user.staff_credentials_set', $target, ['fields' => $changed], $actor);

        return $target;
    }
}
