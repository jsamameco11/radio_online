<?php

use App\Http\Controllers\Studio\CatalogController;
use App\Http\Controllers\Studio\EditorController;
use App\Http\Controllers\Studio\EpisodeController;
use App\Http\Controllers\Studio\LibraryController;
use App\Http\Controllers\Studio\LibraryHealthController;
use App\Http\Controllers\Studio\LibraryIdentifyController;
use App\Http\Controllers\Studio\LibraryUploadController;
use App\Http\Controllers\Studio\PlaylistController;
use App\Http\Controllers\Studio\RecordingController;
use Illuminate\Support\Facades\Route;

/*
| Studio › media: library, recordings, playlists, music catalog, episodes and
| the audio editor (console host, /{frequency}/…, names "studio.*").
| Ids are resolved inside the controllers, scoped to the current station.
*/

Route::middleware('studio.can:library.manage')->group(function () {
    Route::get('/biblioteca', [LibraryController::class, 'index'])->name('library');
    Route::post('/biblioteca', [LibraryController::class, 'store'])->name('library.store');
    Route::post('/biblioteca/identificar', [LibraryIdentifyController::class, 'identify'])->name('library.identify');
    Route::post('/biblioteca/duplicados', [LibraryIdentifyController::class, 'duplicates'])->name('library.duplicates');
    Route::post('/biblioteca/revision', LibraryHealthController::class)->name('library.health');
    Route::match(['put', 'post'], '/biblioteca/{track}', [LibraryController::class, 'update'])->whereUuid('track')->name('library.update');
    Route::delete('/biblioteca/{track}', [LibraryController::class, 'destroy'])->whereUuid('track')->name('library.destroy');
    Route::patch('/biblioteca/{track}/rotacion', [LibraryController::class, 'rotation'])->whereUuid('track')->name('library.rotation');

    Route::get('/grabaciones', [RecordingController::class, 'index'])->name('recordings');
    Route::post('/grabaciones/{recording}/convertir', [RecordingController::class, 'convert'])->whereUuid('recording')->name('recordings.convert');
    Route::delete('/grabaciones/{recording}', [RecordingController::class, 'destroy'])->whereUuid('recording')->name('recordings.destroy');

    Route::get('/listas', [PlaylistController::class, 'index'])->name('playlists');
    Route::post('/listas', [PlaylistController::class, 'store'])->name('playlists.store');
    Route::post('/listas/orden', [PlaylistController::class, 'order'])->name('playlists.order');
    Route::put('/listas/{playlist}', [PlaylistController::class, 'update'])->whereUuid('playlist')->name('playlists.update');
    Route::delete('/listas/{playlist}', [PlaylistController::class, 'destroy'])->whereUuid('playlist')->name('playlists.destroy');
    Route::post('/listas/{playlist}/mezclar', [PlaylistController::class, 'shuffle'])->whereUuid('playlist')->name('playlists.shuffle');

    Route::get('/catalogo', [CatalogController::class, 'index'])->name('catalog');
    Route::post('/catalogo/artistas', [CatalogController::class, 'storeArtist'])->name('catalog.artists.store');
    Route::post('/catalogo/asignar', [CatalogController::class, 'assign'])->name('catalog.assign');
    Route::post('/catalogo/clasificar', [CatalogController::class, 'classify'])->name('catalog.classify');
});

Route::middleware('studio.can:library.manage,episodes.manage')->group(function () {
    Route::post('/biblioteca/subidas', [LibraryUploadController::class, 'store'])->name('library.uploads.store');
    Route::delete('/biblioteca/subidas/{token}', [LibraryUploadController::class, 'destroy'])->where('token', '[A-Za-z0-9]{40}')->name('library.uploads.destroy');

    Route::get('/editor', [EditorController::class, 'index'])->name('editor');
    Route::get('/editor/{track}/analisis', [EditorController::class, 'analysis'])->whereUuid('track')->name('editor.analysis');
    Route::post('/editor/{track}', [EditorController::class, 'store'])->whereUuid('track')->name('editor.store');
    Route::get('/editor/{track}/estado', [EditorController::class, 'status'])->whereUuid('track')->name('editor.status');
    Route::post('/editor/{track}/muestra', [EditorController::class, 'preview'])->whereUuid('track')->name('editor.preview');
    Route::post('/editor/{track}/restaurar', [EditorController::class, 'restore'])->whereUuid('track')->name('editor.restore');
});

Route::middleware('studio.can:episodes.manage')->group(function () {
    Route::get('/episodios', [EpisodeController::class, 'index'])->name('episodes');
    Route::post('/episodios', [EpisodeController::class, 'store'])->name('episodes.store');
    Route::match(['put', 'post'], '/episodios/{episode}', [EpisodeController::class, 'update'])->whereUuid('episode')->name('episodes.update');
    Route::patch('/episodios/{episode}/estado', [EpisodeController::class, 'status'])->whereUuid('episode')->name('episodes.status');
    Route::delete('/episodios/{episode}', [EpisodeController::class, 'destroy'])->whereUuid('episode')->name('episodes.destroy');
});
