<?php

namespace Tests;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Stations\Enums\StationRole;
use App\Models\Station;
use App\Models\User;
use Database\Seeders\AccessSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** Absolute URL on the public host: $this->publicUrl('/explorar'). */
    protected function publicUrl(string $path = '/'): string
    {
        return rtrim((string) config('platform.urls.public'), '/').'/'.ltrim($path, '/');
    }

    /** Absolute URL on the creators' console: $this->consoleUrl('/'). */
    protected function consoleUrl(string $path = '/'): string
    {
        return rtrim((string) config('platform.urls.studio'), '/').'/'.ltrim($path, '/');
    }

    /** Absolute URL on the control host: $this->controlUrl('/admin'). */
    protected function controlUrl(string $path = '/'): string
    {
        return rtrim((string) config('platform.urls.control'), '/').'/'.ltrim($path, '/');
    }

    /** Absolute URL inside a station studio on the console: $this->studioUrl($station, '/consola'). */
    protected function studioUrl(Station $station, string $path = ''): string
    {
        return $this->consoleUrl('/'.$station->frequency->slug.$path);
    }

    /** A member of the platform staff with $role. */
    protected function staff(PlatformRole $role = PlatformRole::SuperAdmin): User
    {
        $this->seed(AccessSeeder::class);

        return tap(User::factory()->create())->assignRole($role->value);
    }

    /** A user on the team of $station with $role. */
    protected function teamMember(Station $station, StationRole $role): User
    {
        $user = User::factory()->create();
        $station->members()->create(['user_id' => $user->id, 'role' => $role]);

        return $user;
    }
}
