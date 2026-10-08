<?php

/*
|--------------------------------------------------------------------------
| Tu Radio Online
|--------------------------------------------------------------------------
|
| Platform-wide settings: the three hosts the application answers on, the
| virtual FM dial, the wallet limits and the timezone used to schedule
| programs. Secrets never live here, only references to the environment.
|
*/

return [

    'name' => env('APP_NAME', 'Tu Radio Online'),

    'timezone' => env('PLATFORM_TIMEZONE', 'America/Lima'),

    // First super administrator, created by Database\Seeders\SuperAdminSeeder. Signs in to the control panel with the username.
    'super_admin' => [
        'name' => env('SUPERADMIN_NAME', 'Superadministrador'),
        'username' => env('SUPERADMIN_USERNAME'),
        'email' => env('SUPERADMIN_EMAIL'),
        'password' => env('SUPERADMIN_PASSWORD'),
    ],

    /*
    | One host per audience (see App\Domain\Platform\PlatformHost): listeners
    | use the public host, creators run their stations from the console host
    | and the platform staff works from the control host.
    */
    'hosts' => [
        'public' => env('PUBLIC_HOST', 'turadioonline.miacademiapreu.com'),
        'studio' => env('STUDIO_HOST', 'consola-fullradio.miacademiapreu.com'),
        'control' => env('CONTROL_HOST', 'control-turadioonline.miacademiapreu.com'),
    ],

    'urls' => [
        'public' => env('PUBLIC_URL', 'https://turadioonline.miacademiapreu.com'),
        'studio' => env('STUDIO_URL', 'https://consola-fullradio.miacademiapreu.com'),
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
        // The description is required: listeners read it first and search ranks it.
        'description_min' => 80,
        'description_max' => 2000,
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
        // Deducted from every gift and highlighted message: the card processor's cost and the
        // platform's share. The station is credited the rest and never sees these deductions.
        'processor_fee_percent' => (int) env('PROCESSOR_FEE_PERCENT', 5),
        'platform_fee_percent' => (int) env('PLATFORM_FEE_PERCENT', 10),
    ],

    'gifts' => [
        'max_message_length' => 280,
        'max_voice_seconds' => 60,
        'max_voice_kilobytes' => 4096,
    ],

    /*
    | Live chat: signed-in listeners write to a station while it is live. A
    | highlighted message is paid from the wallet (same fee as gifts); the
    | higher the tier, the longer it stays pinned in the chat.
    */
    'chat' => [
        'max_message_length' => 200,
        // Messages kept and shown when someone opens the chat.
        'history' => 60,
        'highlight_tiers' => [
            ['cents' => 100, 'pin_seconds' => 0],
            ['cents' => 200, 'pin_seconds' => 60],
            ['cents' => 500, 'pin_seconds' => 180],
            ['cents' => 1000, 'pin_seconds' => 300],
            ['cents' => 2000, 'pin_seconds' => 600],
            ['cents' => 5000, 'pin_seconds' => 1200],
        ],
    ],

    /*
    | Growth and monetization: a station can ask to be monetized once it has
    | min_subscribers and, on live_days consecutive days, a live broadcast
    | reached live_listeners simultaneous listeners. Earnings can be withdrawn
    | from day one, starting at min_withdrawal_cents.
    */
    'monetization' => [
        'min_subscribers' => 5000,
        'live_listeners' => 800,
        'live_days' => 3,
        'min_withdrawal_cents' => 5000,
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
            // Genre a song gets, marked as a guess to review, when nothing tells its genre; empty for none.
            'fallback_genre' => env('MUSIC_FALLBACK_GENRE', 'Música variada'),
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
