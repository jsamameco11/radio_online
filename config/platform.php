<?php

/*
|--------------------------------------------------------------------------
| Tu Radio Online
|--------------------------------------------------------------------------
|
| Platform-wide settings: the two hosts the application answers on, the
| virtual FM dial, the wallet limits and the timezone used to schedule
| programs. Secrets never live here, only references to the environment.
|
*/

return [

    'name' => env('APP_NAME', 'Tu Radio Online'),

    'timezone' => env('PLATFORM_TIMEZONE', 'America/Lima'),

    // First super administrator, created by Database\Seeders\SuperAdminSeeder.
    'super_admin' => [
        'name' => env('SUPERADMIN_NAME', 'Superadministrador'),
        'email' => env('SUPERADMIN_EMAIL'),
        'password' => env('SUPERADMIN_PASSWORD'),
    ],

    /*
    | Listeners use the public host; the platform staff and every station
    | team work from the control host (super admin panel and studios).
    */
    'hosts' => [
        'public' => env('PUBLIC_HOST', 'turadioonline.miacademiapreu.com'),
        'control' => env('CONTROL_HOST', 'control-turadioonline.miacademiapreu.com'),
    ],

    'urls' => [
        'public' => env('PUBLIC_URL', 'https://turadioonline.miacademiapreu.com'),
        'control' => env('CONTROL_URL', 'https://control-turadioonline.miacademiapreu.com'),
    ],

    /*
    | The dial: how many virtual frequencies exist and the FM band they are
    | spread over. Growing the dial only means raising the size and seeding
    | again; existing frequencies never move.
    */
    'dial' => [
        'size' => (int) env('DIAL_SIZE', 500),
        'band' => 'FM',
        'min' => 87.70,
        'max' => 107.90,
        'seed' => 1983,
    ],

    'stations' => [
        'max_categories' => 3,
        'max_permanent_hashtags' => 10,
        'max_topic_hashtags' => 5,
    ],

    /*
    | Money is always handled in integer cents of the platform currency.
    */
    'wallet' => [
        'currency' => 'USD',
        'min_deposit_cents' => 500,
        'max_deposit_cents' => 100_000,
        'deposit_presets_cents' => [500, 1000, 2000, 5000, 10_000],
        // Share of every gift kept by the platform; the rest is credited to the station.
        'platform_fee_percent' => (int) env('GIFT_PLATFORM_FEE_PERCENT', 30),
    ],

    'gifts' => [
        'max_message_length' => 280,
        'max_voice_seconds' => 60,
        'max_voice_kilobytes' => 4096,
    ],

    'payments' => [
        // "stripe" in production; "sandbox" credits deposits at once for local development.
        'driver' => env('PAYMENTS_DRIVER', 'sandbox'),
    ],

];
