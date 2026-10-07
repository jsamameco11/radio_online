<?php

namespace Database\Seeders;

use App\Domain\Frequencies\Actions\ExpandDial;
use Illuminate\Database\Seeder;

/**
 * Puts the dial on the air: creates the frequencies the configured size asks
 * for. Running it again after raising DIAL_SIZE only adds the new ones; the
 * staff can also grow the dial from the control panel.
 */
class DialSeeder extends Seeder
{
    public function run(): void
    {
        app(ExpandDial::class)->handle((int) config('platform.dial.size'));
    }
}
