<?php

use App\Http\Controllers\Studio\FinanceController;
use App\Http\Controllers\Studio\GiftController;
use App\Http\Controllers\Studio\GiftMessageController;
use App\Http\Controllers\Studio\GiftSettingsController;
use Illuminate\Support\Facades\Route;

/*
| Studio › gifts, listener messages, finances and their settings
| (console host, /{frequency}/…, names "studio.*").
*/

Route::middleware('studio.can:gifts.view')->group(function () {
    Route::get('/regalos', [GiftController::class, 'index'])->name('gifts');
    Route::get('/regalos/recientes', [GiftController::class, 'recent'])->name('gifts.recent');

    Route::get('/mensajes', [GiftMessageController::class, 'index'])->name('messages');
    Route::get('/mensajes/{message}/audio', [GiftMessageController::class, 'audio'])->name('messages.audio');
    Route::post('/mensajes/{message}/reproducido', [GiftMessageController::class, 'played'])->name('messages.played');
    Route::patch('/mensajes/{message}/visibilidad', [GiftMessageController::class, 'visibility'])->name('messages.visibility');
    Route::post('/mensajes/{message}/reportar', [GiftMessageController::class, 'report'])->name('messages.report');
});

Route::get('/finanzas', FinanceController::class)->middleware('studio.can:finance.view')->name('finances');

Route::middleware('studio.can:station.settings')->group(function () {
    Route::get('/configuracion/regalos', [GiftSettingsController::class, 'gifts'])->name('settings.gifts');
    Route::put('/configuracion/regalos', [GiftSettingsController::class, 'updateGifts'])->name('settings.gifts.update');
    Route::get('/configuracion/mensajes', [GiftSettingsController::class, 'messages'])->name('settings.messages');
    Route::put('/configuracion/mensajes', [GiftSettingsController::class, 'updateMessages'])->name('settings.messages.update');
});
