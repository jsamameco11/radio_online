<?php

namespace Database\Seeders;

use App\Domain\Access\Enums\Permission;
use App\Domain\Access\Enums\PlatformRole;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission as PermissionModel;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/** Platform roles and permissions, straight from their enums. Safe to run again. */
class AccessSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (Permission::cases() as $permission) {
            PermissionModel::findOrCreate($permission->value, 'web');
        }

        foreach (PlatformRole::cases() as $platformRole) {
            Role::findOrCreate($platformRole->value, 'web')
                ->syncPermissions(array_map(fn (Permission $permission) => $permission->value, $platformRole->permissions()));
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
