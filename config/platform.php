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
        // "culqi" in production; "sandbox" simulates an approved card for local development.
        'driver' => env('PAYMENTS_DRIVER', 'sandbox'),
    ],

    /*
    | Studio media: the audio library, episodes and the audio editor. With
    | Wasabi, audio goes from the browser straight to the bucket in parts;
    | without it, the file travels with the form up to max_form_upload_mb.
    */
    'media' => [
        'ffmpeg' => env('FFMPEG_BINARY') ?: 'ffmpeg',
        'max_form_upload_mb' => 75,
        'max_direct_upload_mb' => 2048,
        'max_cover_mb' => 8,
        'max_episode_hashtags' => 8,
        // Longest audio a library accepts, in seconds.
        'max_duration' => 6 * 3600,
        'identify' => [
            'user_agent' => env('MUSIC_LOOKUP_USER_AGENT') ?: 'TuRadioOnline/1.0 (https://turadioonline.miacademiapreu.com)',
            'timeout' => 8,
            'store_country' => env('MUSIC_LOOKUP_COUNTRY', 'US'),
            // MusicBrainz allows one request per second per client.
            'musicbrainz_gap_ms' => 1100,
        ],
    ],

    /*
    | Listening: the live microphone reaches listeners over WebRTC (a TURN
    | relay lets it cross strict networks), presence windows and the checks
    | that keep broken library files off the air.
    */
    'streaming' => [
        'stun_urls' => ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
        'turn_url' => env('TURN_URL'),
        'turn_username' => env('TURN_USERNAME'),
        'turn_credential' => env('TURN_CREDENTIAL'),
        // Seconds without a heartbeat after which a listener counts as gone.
        'listener_window' => 45,
        'verify_files' => (bool) env('STREAMING_VERIFY_FILES', true),
        // Days an unsaved live recording is kept before it is deleted.
        'recording_days' => 2,
    ],

];
