<?php

namespace App\Domain\Access\Enums;

/**
 * Platform-wide roles, stored with spatie/laravel-permission.
 *
 * Station owners, managers, hosts and editors are not platform roles: they
 * belong to one station team (see App\Domain\Stations\Enums\StationRole).
 */
enum PlatformRole: string
{
    case SuperAdmin = 'super_admin';
    case Admin = 'admin';
    case Moderator = 'moderator';
    case Listener = 'user';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Superadministrador',
            self::Admin => 'Administrador',
            self::Moderator => 'Moderador',
            self::Listener => 'Usuario',
        };
    }

    /** Staff roles sign in to the control panel and must use two-factor authentication. */
    public function isStaff(): bool
    {
        return $this !== self::Listener;
    }

    /**
     * @return list<Permission>
     */
    public function permissions(): array
    {
        return match ($this) {
            self::SuperAdmin => Permission::cases(),
            self::Admin => array_values(array_filter(
                Permission::cases(),
                fn (Permission $permission) => ! in_array($permission, [Permission::ManageRoles, Permission::ManageSettings, Permission::AdjustWallets], true),
            )),
            self::Moderator => [
                Permission::ViewStations,
                Permission::MonitorStreams,
                Permission::ViewUsers,
                Permission::ManageModeration,
            ],
            self::Listener => [],
        };
    }
}
