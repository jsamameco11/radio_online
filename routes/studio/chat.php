<?php

use App\Http\Controllers\Studio\ChatController;
use Illuminate\Support\Facades\Route;

/*
| Studio › live chat: the team reads, answers and moderates the chat of the
| station while it is on air (console host, /{frequency}/…, names "studio.*").
*/

Route::middleware('studio.can:console.operate')->group(function () {
    Route::get('/chat', [ChatController::class, 'index'])->name('chat');
    Route::get('/chat/mensajes', [ChatController::class, 'feed'])->middleware('throttle:240,1')->name('chat.feed');
    Route::post('/chat/mensajes', [ChatController::class, 'reply'])->middleware('throttle:60,1')->name('chat.reply');
    Route::patch('/chat/mensajes/{message}/visibilidad', [ChatController::class, 'visibility'])->middleware('throttle:120,1')->name('chat.visibility');
    Route::post('/chat/silenciados', [ChatController::class, 'mute'])->middleware('throttle:60,1')->name('chat.mute');
    Route::delete('/chat/silenciados/{user}', [ChatController::class, 'unmute'])->whereNumber('user')->middleware('throttle:60,1')->name('chat.unmute');
});
