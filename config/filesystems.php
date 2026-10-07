<?php

$wasabi = [
    'driver' => 's3',
    'key' => env('WASABI_ACCESS_KEY'),
    'secret' => env('WASABI_SECRET_KEY'),
    'region' => env('WASABI_REGION', 'us-central-1'),
    'bucket' => env('WASABI_BUCKET'),
    'endpoint' => rtrim((string) env('WASABI_ENDPOINT', 'https://s3.us-central-1.wasabisys.com'), '/'),
    'use_path_style_endpoint' => true,
    'throw' => true,
    'report' => true,
];

// Keeps local or staging uploads apart from production inside the same bucket (e.g. WASABI_PREFIX=dev).
$wasabiPrefix = trim((string) env('WASABI_PREFIX', ''), '/');
$wasabiPrefix = $wasabiPrefix === '' ? '' : $wasabiPrefix.'/';

return [

    'default' => env('FILESYSTEM_DISK', 'local'),

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        // Station artwork and broadcast audio: readable by anyone holding the URL.
        'wasabi' => [
            ...$wasabi,
            'url' => $wasabi['endpoint'].'/'.$wasabi['bucket'],
            'root' => $wasabiPrefix.'public',
            'visibility' => 'public',
        ],

        // Listener voice messages and raw recordings: only reachable through short-lived signed URLs.
        'wasabi-private' => [
            ...$wasabi,
            'root' => $wasabiPrefix.'private',
            'visibility' => 'private',
        ],

    ],

    /*
    | Disks App\Domain\Storage\MediaStorage writes to: Wasabi when a bucket is
    | configured, the local disks otherwise (development and tests).
    */
    'media' => [
        'public' => env('WASABI_BUCKET') ? 'wasabi' : 'public',
        'private' => env('WASABI_BUCKET') ? 'wasabi-private' : 'local',
    ],

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
