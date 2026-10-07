<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            AccessSeeder::class,
            CategorySeeder::class,
            DialSeeder::class,
            GiftSeeder::class,
            SuperAdminSeeder::class,
        ]);

        if (app()->isLocal()) {
            $this->call(DemoStationsSeeder::class);
        }
    }
}
