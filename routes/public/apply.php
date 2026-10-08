<?php

use App\Http\Controllers\Public\FrequencyPaymentController;
use App\Http\Controllers\Public\MovedApplicationController;
use App\Http\Controllers\Public\StationApplicationController;
use Illuminate\Support\Facades\Route;

/*
| "Obtén tu frecuencia": anyone with a verified account applies for a station
| with the full dossier of the person who will run it. Its old address,
| /crear-mi-radio, moves permanently so shared links keep working.
*/

Route::middleware(['auth', 'verified'])->prefix('/obten-tu-frecuencia')->name('site.station-requests.')->group(function () {
    Route::get('/', [StationApplicationController::class, 'create'])->name('create');
    Route::post('/', [StationApplicationController::class, 'store'])->middleware('throttle:6,1')->name('store');
    Route::delete('/solicitudes/{frequencyRequest}', [StationApplicationController::class, 'destroy'])->name('destroy');
    Route::get('/solicitudes/{frequencyRequest}/pago', [FrequencyPaymentController::class, 'show'])->name('payment');
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/solicitudes/{frequencyRequest}/tarjeta', [FrequencyPaymentController::class, 'card'])->name('card');
        Route::post('/solicitudes/{frequencyRequest}/pago', [FrequencyPaymentController::class, 'pay'])->name('pay');
    });
});

Route::get('/crear-mi-radio', MovedApplicationController::class)->name('site.station-requests.moved');
