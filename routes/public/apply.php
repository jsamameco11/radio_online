<?php

use App\Http\Controllers\Public\StationApplicationController;
use Illuminate\Support\Facades\Route;

/*
| "Crear mi radio": anyone with a verified account applies for a station
| with the full dossier of the person who will run it.
*/

Route::middleware(['auth', 'verified'])->prefix('/crear-mi-radio')->name('site.station-requests.')->group(function () {
    Route::get('/', [StationApplicationController::class, 'create'])->name('create');
    Route::post('/', [StationApplicationController::class, 'store'])->middleware('throttle:6,1')->name('store');
    Route::delete('/solicitudes/{frequencyRequest}', [StationApplicationController::class, 'destroy'])->name('destroy');
});
