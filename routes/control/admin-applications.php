<?php

use App\Http\Controllers\Admin\StationApplicationController;
use Illuminate\Support\Facades\Route;

/*
| Admin > Solicitudes > Expediente: the "Crear mi radio" dossier and its
| private documents, for the staff who review frequency requests.
*/

Route::middleware('can:frequency_requests.review')->group(function () {
    Route::get('/solicitudes/{frequencyRequest}/expediente', [StationApplicationController::class, 'show'])->name('applications.show');
    Route::get('/solicitudes/{frequencyRequest}/archivos/{file}', [StationApplicationController::class, 'file'])
        ->where('file', 'foto|documento-anverso|documento-reverso|cv|certificado-[1-9]')
        ->middleware('throttle:60,1')
        ->name('applications.file');
});
