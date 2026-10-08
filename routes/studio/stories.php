<?php

use App\Http\Controllers\Studio\StoryController;
use Illuminate\Support\Facades\Route;

/*
| Studio › Estados: stories the station shares for 24 hours (console host,
| /{frequency}/estados, names "studio.stories*").
*/

Route::middleware('studio.can:station.profile')->group(function () {
    Route::get('/estados', [StoryController::class, 'index'])->name('stories');
    Route::post('/estados', [StoryController::class, 'store'])->middleware('throttle:20,1')->name('stories.store');
    Route::delete('/estados/{story}', [StoryController::class, 'destroy'])->whereUuid('story')->name('stories.destroy');
});
