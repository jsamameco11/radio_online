<!DOCTYPE html>
<html lang="es" class="h-full antialiased" data-host="{{ $page['props']['app']['host'] ?? 'public' }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="theme-color" content="#0b0b10">
        <meta name="description" content="La radio de internet: descubre, escucha y transmite en tu propia frecuencia.">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <title inertia>{{ config('platform.name') }}</title>
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="min-h-full font-sans">
        @inertia
    </body>
</html>
