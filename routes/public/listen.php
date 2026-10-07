<?php

use App\Http\Controllers\Public\ListenController;
use Illuminate\Support\Facades\Route;

/*
| What a station player talks to while it plays: the program (polled every
| few seconds), its presence in the audience, the live-microphone handshake
| and the audios it could not play. Audio never travels through here.
*/

Route::middleware(['auth', 'verified'])->prefix('/radio/{frequency}')->name('listen.')->group(function () {
    Route::get('/estado', [ListenController::class, 'state'])->middleware('throttle:600,1')->name('state');
    Route::post('/escucha', [ListenController::class, 'heartbeat'])->middleware('throttle:60,1')->name('heartbeat');
    Route::post('/salir', [ListenController::class, 'leave'])->middleware('throttle:60,1')->name('leave');
    Route::post('/voz', [ListenController::class, 'voice'])->middleware('throttle:120,1')->name('voice');
    Route::post('/voz/respuesta', [ListenController::class, 'answer'])->middleware('throttle:120,1')->name('voice.answer');
    Route::post('/fallo', [ListenController::class, 'failed'])->middleware('throttle:30,1')->name('failed');
});
