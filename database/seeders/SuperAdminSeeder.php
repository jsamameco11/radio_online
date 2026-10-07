<?php

namespace Database\Seeders;

use App\Domain\Access\Enums\PlatformRole;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The first super administrator, from SUPERADMIN_* in the environment.
 * Skipped when those are empty; never overwrites an existing password.
 */
class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = (string) config('platform.super_admin.email');
        $password = (string) config('platform.super_admin.password');

        if ($email === '' || $password === '') {
            $this->command?->warn('SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD are empty: no super administrator was created.');

            return;
        }

        $user = User::query()->firstOrCreate(
            ['email' => strtolower($email)],
            ['name' => (string) config('platform.super_admin.name'), 'password' => $password],
        );
        $user->forceFill(['email_verified_at' => $user->email_verified_at ?? now()])->save();
        $user->assignRole(PlatformRole::SuperAdmin->value);
    }
}
