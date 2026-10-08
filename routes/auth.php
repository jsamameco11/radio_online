<?php

use App\Domain\Access\Support\SessionHandoff;
use App\Http\Controllers\Auth\GoogleController;
use App\Http\Controllers\Auth\SessionHandoffController;
use Illuminate\Support\Facades\Route;

/*
| Sign in with Google, on every host: each host sends Google its own callback URL.
| /ir/{escuchar|consola} and /acceso/{pass} carry the session between the
| listeners' site and the creators' console (SessionHandoff).
*/

Route::middleware(['guest', 'throttle:10,1'])->prefix('auth/google')->name('auth.google.')->group(function () {
    Route::get('/', [GoogleController::class, 'redirect'])->name('redirect');
    Route::get('/callback', [GoogleController::class, 'callback'])->name('callback');
});

Route::middleware('throttle:30,1')->name('handoff.')->group(function () {
    Route::get('/ir/{target}', [SessionHandoffController::class, 'leave'])->whereIn('target', array_keys(SessionHandoff::TARGETS))->name('leave');
    Route::get('/acceso/{pass}', [SessionHandoffController::class, 'arrive'])->where('pass', '[A-Za-z0-9]{64}')->name('arrive');
});
