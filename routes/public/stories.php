<?php

use App\Http\Controllers\Public\StoryController;
use Illuminate\Support\Facades\Route;

/*
| Estados on the listener platform: anyone watches them (guests count as viewers
| by their session); reporting one asks for a signed-in, verified account.
*/

Route::name('site.stories.')->group(function () {
    Route::get('/estados', [StoryController::class, 'rail'])->middleware('throttle:60,1')->name('rail');

    Route::prefix('/radio/{frequency:slug}/estados')->group(function () {
        Route::get('/', [StoryController::class, 'index'])->middleware('throttle:120,1')->name('index');
        Route::post('/{story}/visto', [StoryController::class, 'view'])->whereUuid('story')->middleware('throttle:240,1')->name('view');
        Route::post('/{story}/reportar', [StoryController::class, 'report'])
            ->whereUuid('story')
            ->middleware(['auth', 'verified', 'throttle:10,1'])
            ->name('report');
    });
});
