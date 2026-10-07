<?php

use App\Http\Controllers\Auth\GoogleController;
use Illuminate\Support\Facades\Route;

/*
| Sign in with Google, on every host: each host sends Google its own callback URL.
*/

Route::middleware(['guest', 'throttle:10,1'])->prefix('auth/google')->name('auth.google.')->group(function () {
    Route::get('/', [GoogleController::class, 'redirect'])->name('redirect');
    Route::get('/callback', [GoogleController::class, 'callback'])->name('callback');
});
