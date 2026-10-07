<?php

use App\Http\Controllers\Public\ChatController;
use Illuminate\Support\Facades\Route;

/*
| Live chat on the public host: listeners read the chat of a station on air
| and, signed in, write to it or pay to highlight a message.
*/

Route::prefix('/radio/{frequency}/chat')->name('chat.')->group(function () {
    Route::get('/', [ChatController::class, 'index'])->middleware('throttle:120,1')->name('index');

    Route::middleware(['auth', 'verified'])->group(function () {
        Route::post('/', [ChatController::class, 'store'])->middleware('throttle:20,1')->name('store');
        Route::post('/{message}/reportar', [ChatController::class, 'report'])->middleware('throttle:10,1')->name('report');
    });
});
