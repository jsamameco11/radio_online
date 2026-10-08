<?php

use App\Http\Controllers\Studio\ConsoleCaptureController;
use App\Http\Controllers\Studio\ConsoleController;
use App\Http\Controllers\Studio\ConsoleLayerController;
use App\Http\Controllers\Studio\ConsoleMusicController;
use App\Http\Controllers\Studio\ConsoleProgramController;
use App\Http\Controllers\Studio\ScheduleController;
use App\Http\Controllers\Studio\Settings\AudioSettingsController;
use App\Http\Controllers\Studio\Settings\AutomationSettingsController;
use App\Http\Controllers\Studio\Settings\BroadcastSettingsController;
use Illuminate\Support\Facades\Route;

/*
| Studio — broadcast: the live console, the schedule and the broadcast
| settings (console host, /{frequency}/…, names "studio.*"). Console and schedule
| actions answer JSON; ids are resolved inside the controllers, scoped to the
| current station.
*/

Route::middleware('studio.can:console.operate')->prefix('/consola')->name('console')->group(function () {
    Route::get('/', [ConsoleController::class, 'index']);
    Route::get('/senal', [ConsoleController::class, 'signal'])->middleware('throttle:120,1')->name('.signal');
    Route::post('/senal/oferta', [ConsoleController::class, 'offer'])->middleware('throttle:240,1')->name('.offer');

    Route::post('/vivo', [ConsoleController::class, 'startLive'])->name('.live.start');
    Route::delete('/vivo', [ConsoleController::class, 'endLive'])->name('.live.end');
    Route::put('/aire', [ConsoleController::class, 'air'])->name('.air');
    Route::put('/mezcla', [ConsoleController::class, 'mix'])->middleware('throttle:240,1')->name('.mix');
    Route::put('/modo-vivo', [ConsoleController::class, 'mode'])->name('.live-mode');

    Route::post('/capas', [ConsoleLayerController::class, 'play'])->middleware('throttle:240,1')->name('.layers.play');
    Route::delete('/capas', [ConsoleLayerController::class, 'stop'])->middleware('throttle:240,1')->name('.layers.stop');
    Route::patch('/capas/{layer}', [ConsoleLayerController::class, 'update'])->where('layer', '[a-z0-9]{12}')->name('.layers.update');
    Route::put('/botonera', [ConsoleLayerController::class, 'pads'])->name('.pads');
    Route::post('/efectos', [ConsoleLayerController::class, 'effect'])->middleware('throttle:120,1')->name('.effects.store');

    Route::post('/lanzar', [ConsoleProgramController::class, 'launch'])->name('.launch');
    Route::patch('/bloques/{slot}', [ConsoleProgramController::class, 'reschedule'])->whereUuid('slot')->name('.reschedule');

    Route::post('/corte', [ConsoleMusicController::class, 'cut'])->name('.cut');
    Route::delete('/corte', [ConsoleMusicController::class, 'resume'])->name('.resume');
    Route::post('/musica', [ConsoleMusicController::class, 'start'])->name('.music.start');
    Route::put('/musica/fuente', [ConsoleMusicController::class, 'source'])->name('.music.source');
    Route::delete('/musica/cambio', [ConsoleMusicController::class, 'cancel'])->name('.music.cancel');
    Route::get('/musica/puntos', [ConsoleMusicController::class, 'points'])->name('.music.points');
    Route::put('/musica/continua', [ConsoleMusicController::class, 'autofill'])->name('.music.autofill');
    Route::put('/musica/repetir', [ConsoleMusicController::class, 'repeat'])->name('.music.repeat');
    Route::delete('/musica/no-repetir/{track}', [ConsoleMusicController::class, 'drop'])->whereUuid('track')->name('.music.drop');

    Route::middleware('throttle:240,1')->prefix('/grabacion')->name('.capture')->group(function () {
        Route::post('/', [ConsoleCaptureController::class, 'start'])->name('.start');
        Route::post('/{recording}/partes', [ConsoleCaptureController::class, 'chunk'])->whereUuid('recording')->name('.chunk');
        Route::post('/{recording}/fin', [ConsoleCaptureController::class, 'finish'])->whereUuid('recording')->name('.finish');
        Route::post('/{recording}/guardar', [ConsoleCaptureController::class, 'save'])->whereUuid('recording')->name('.save');
        Route::delete('/{recording}', [ConsoleCaptureController::class, 'discard'])->whereUuid('recording')->name('.discard');
    });
});

Route::get('/programacion/linea', [ScheduleController::class, 'program'])
    ->middleware(['studio.can:console.operate,schedule.manage', 'throttle:120,1'])
    ->name('schedule.program');

Route::middleware('studio.can:schedule.manage')->prefix('/programacion')->name('schedule')->group(function () {
    Route::get('/', [ScheduleController::class, 'index']);
    Route::post('/bloques', [ScheduleController::class, 'store'])->name('.store');
    Route::put('/bloques/{slot}', [ScheduleController::class, 'update'])->whereUuid('slot')->name('.update');
    Route::delete('/bloques/{slot}', [ScheduleController::class, 'destroy'])->whereUuid('slot')->name('.destroy');
    Route::delete('/dias/{date}', [ScheduleController::class, 'clear'])->where('date', '\d{4}-\d{2}-\d{2}')->name('.clear');
    Route::post('/copiar', [ScheduleController::class, 'copy'])->name('.copy');
    Route::put('/rotacion', [ScheduleController::class, 'rotation'])->name('.rotation');

    Route::post('/musica', [ConsoleMusicController::class, 'start'])->name('.music.start');
    Route::put('/musica/fuente', [ConsoleMusicController::class, 'source'])->name('.music.source');
    Route::delete('/musica/cambio', [ConsoleMusicController::class, 'cancel'])->name('.music.cancel');
    Route::get('/musica/puntos', [ConsoleMusicController::class, 'points'])->name('.music.points');
    Route::put('/musica/continua', [ConsoleMusicController::class, 'autofill'])->name('.music.autofill');
    Route::put('/musica/repetir', [ConsoleMusicController::class, 'repeat'])->name('.music.repeat');
});

Route::middleware('studio.can:station.settings')->prefix('/configuracion')->name('settings.')->group(function () {
    Route::get('/transmision', [BroadcastSettingsController::class, 'edit'])->name('broadcast');
    Route::put('/transmision', [BroadcastSettingsController::class, 'update'])->name('broadcast.update');
    Route::get('/audio', [AudioSettingsController::class, 'edit'])->name('audio');
    Route::put('/audio', [AudioSettingsController::class, 'update'])->name('audio.update');
    Route::get('/automatizacion', [AutomationSettingsController::class, 'edit'])->name('automation');
    Route::put('/automatizacion', [AutomationSettingsController::class, 'update'])->name('automation.update');
});
