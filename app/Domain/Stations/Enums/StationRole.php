<?php

namespace App\Domain\Stations\Enums;

/**
 * The role a user holds inside one station team.
 */
enum StationRole: string
{
    case Owner = 'owner';
    case Manager = 'manager';
    case Host = 'host';
    case Editor = 'editor';

    public function label(): string
    {
        return match ($this) {
            self::Owner => 'Propietario',
            self::Manager => 'Administrador de radio',
            self::Host => 'Locutor',
            self::Editor => 'Editor de contenido',
        };
    }

    /**
     * @return list<StationPermission>
     */
    public function permissions(): array
    {
        return match ($this) {
            self::Owner => StationPermission::cases(),
            self::Manager => array_values(array_filter(
                StationPermission::cases(),
                fn (StationPermission $permission) => ! in_array($permission, [StationPermission::ManageMembers, StationPermission::ViewFinance, StationPermission::WithdrawEarnings, StationPermission::SellStation], true),
            )),
            self::Host => [
                StationPermission::OperateConsole,
                StationPermission::ViewGifts,
                StationPermission::ViewAnalytics,
            ],
            self::Editor => [
                StationPermission::ManageLibrary,
                StationPermission::ManageEpisodes,
                StationPermission::ManageSchedule,
            ],
        };
    }

    public function allows(StationPermission $permission): bool
    {
        return in_array($permission, $this->permissions(), true);
    }
}
