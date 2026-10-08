<?php

use App\Http\Controllers\Public\CategoryController;
use App\Http\Controllers\Public\DialController;
use App\Http\Controllers\Public\EpisodeController;
use App\Http\Controllers\Public\ExploreController;
use App\Http\Controllers\Public\FollowController;
use App\Http\Controllers\Public\FollowingController;
use App\Http\Controllers\Public\HashtagController;
use App\Http\Controllers\Public\HistoryController;
use App\Http\Controllers\Public\HomeController;
use App\Http\Controllers\Public\LiveController;
use App\Http\Controllers\Public\ReportController;
use App\Http\Controllers\Public\SearchController;
use App\Http\Controllers\Public\StationController;
use App\Http\Controllers\Public\StationRatingController;
use Illuminate\Support\Facades\Route;

/*
| The listener platform. Anyone discovers and listens to the stations; following,
| reporting and the personal pages ask for a signed-in, verified account.
*/

Route::name('site.')->group(function () {
    Route::get('/', HomeController::class)->name('home');
    Route::get('/explorar', ExploreController::class)->name('explore');
    Route::get('/en-vivo', LiveController::class)->name('live');
    Route::get('/dial', DialController::class)->name('dial');
    Route::get('/buscar', SearchController::class)->name('search');

    Route::get('/categorias', [CategoryController::class, 'index'])->name('categories.index');
    Route::get('/categorias/{category:slug}', [CategoryController::class, 'show'])->name('categories.show');
    Route::get('/hashtag/{hashtag:slug}', HashtagController::class)->name('hashtags.show');

    Route::prefix('/radio/{frequency:slug}')->name('stations.')->group(function () {
        Route::get('/', [StationController::class, 'show'])->name('show');
        Route::get('/episodios/{episode}', [EpisodeController::class, 'show'])->whereUuid('episode')->name('episodes.show');

        Route::middleware(['auth', 'verified'])->group(function () {
            Route::post('/calificar', [StationRatingController::class, 'store'])->middleware('throttle:30,1')->name('rate');
            Route::post('/suscribirme', [FollowController::class, 'store'])->middleware('throttle:30,1')->name('follow');
            Route::delete('/suscribirme', [FollowController::class, 'destroy'])->middleware('throttle:30,1')->name('unfollow');
            Route::post('/reportar', [ReportController::class, 'station'])->middleware('throttle:10,1')->name('report');
            Route::post('/episodios/{episode}/reportar', [ReportController::class, 'episode'])->whereUuid('episode')->middleware('throttle:10,1')->name('episodes.report');
        });
    });

    Route::middleware(['auth', 'verified'])->group(function () {
        Route::get('/mis-radios', FollowingController::class)->name('following');
        Route::get('/historial', HistoryController::class)->name('history');
    });
});
