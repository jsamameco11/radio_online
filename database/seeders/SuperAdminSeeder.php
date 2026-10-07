<?php

namespace Database\Seeders;

use App\Domain\Access\Enums\PlatformRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * The first super administrator, from SUPERADMIN_* in the environment. It signs in to the
 * control panel with SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD.
 *
 * Skipped when those are empty. The account takes the password once, when it is created or
 * receives its username; a password changed later from the security page is kept.
 */
class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $username = Str::lower(trim((string) config('platform.super_admin.username')));
        $email = Str::lower(trim((string) config('platform.super_admin.email')));
        $password = (string) config('platform.super_admin.password');

        if ($username === '' || $email === '' || $password === '') {
            $this->command?->warn('SUPERADMIN_USERNAME / SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD are empty: no super administrator was created.');

            return;
        }

        $user = User::query()->where('username', $username)->first()
            ?? User::query()->where('email', $email)->first()
            ?? new User(['email' => $email, 'name' => (string) config('platform.super_admin.name')]);

        if ($user->username === null) {
            $user->forceFill(['username' => $username, 'password' => $password]);
        }

        $user->forceFill(['email_verified_at' => $user->email_verified_at ?? now()])->save();
        $user->assignRole(PlatformRole::SuperAdmin->value);
    }
}
