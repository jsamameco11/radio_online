<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DialController;
use App\Http\Controllers\Admin\FrequencyController;
use App\Http\Controllers\Admin\FrequencyRequestController;
use App\Http\Controllers\Admin\ModerationController;
use App\Http\Controllers\Admin\MonitorController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\StationController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/', DashboardController::class)->name('dashboard');

Route::middleware('can:streams.monitor')->group(function () {
    Route::get('/monitor', [MonitorController::class, 'index'])->name('monitor');
    Route::get('/monitor/estado', [MonitorController::class, 'cells'])->name('monitor.cells');
    Route::get('/monitor/frecuencias/{frequency}', [MonitorController::class, 'show'])->name('monitor.show');
});

Route::middleware('can:settings.manage')->group(function () {
    Route::get('/frecuencias/ampliar', [DialController::class, 'create'])->name('frequencies.expand');
    Route::post('/frecuencias/ampliar', [DialController::class, 'store'])->name('frequencies.expand.store');
    Route::get('/configuracion', [SettingsController::class, 'edit'])->name('settings');
    Route::put('/configuracion', [SettingsController::class, 'update'])->name('settings.update');
});

Route::middleware('can:frequencies.view')->group(function () {
    Route::get('/frecuencias', [FrequencyController::class, 'index'])->name('frequencies.index');
    Route::get('/frecuencias/{frequency}', [FrequencyController::class, 'show'])->name('frequencies.show');
    Route::middleware('can:frequencies.assign')->group(function () {
        Route::post('/frecuencias/{frequency}/reservar', [FrequencyController::class, 'reserve'])->name('frequencies.reserve');
        Route::post('/frecuencias/{frequency}/asignar', [FrequencyController::class, 'assign'])->name('frequencies.assign');
        Route::post('/frecuencias/{frequency}/mantenimiento', [FrequencyController::class, 'maintenance'])->name('frequencies.maintenance');
    });
    Route::post('/frecuencias/{frequency}/liberar', [FrequencyController::class, 'release'])
        ->middleware('can:frequencies.release')
        ->name('frequencies.release');
});

Route::middleware('can:frequency_requests.review')->group(function () {
    Route::get('/solicitudes', [FrequencyRequestController::class, 'index'])->name('requests.index');
    Route::post('/solicitudes/{frequencyRequest}/aprobar', [FrequencyRequestController::class, 'approve'])->name('requests.approve');
    Route::post('/solicitudes/{frequencyRequest}/rechazar', [FrequencyRequestController::class, 'reject'])->name('requests.reject');
});

Route::middleware('can:stations.view')->group(function () {
    Route::get('/radios', [StationController::class, 'index'])->name('stations.index');
    Route::get('/radios/{station}', [StationController::class, 'show'])->withTrashed()->name('stations.show');
    Route::put('/radios/{station}', [StationController::class, 'update'])->middleware('can:stations.update')->name('stations.update');
    Route::middleware('can:stations.suspend')->group(function () {
        Route::post('/radios/{station}/suspender', [StationController::class, 'suspend'])->name('stations.suspend');
        Route::post('/radios/{station}/reactivar', [StationController::class, 'reactivate'])->name('stations.reactivate');
    });
});

Route::middleware('can:users.view')->group(function () {
    Route::get('/usuarios', [UserController::class, 'index'])->name('users.index');
    Route::get('/usuarios/{user}', [UserController::class, 'show'])->name('users.show');
    Route::middleware('can:users.manage')->group(function () {
        Route::post('/usuarios/{user}/suspender', [UserController::class, 'suspend'])->name('users.suspend');
        Route::post('/usuarios/{user}/reactivar', [UserController::class, 'reactivate'])->name('users.reactivate');
    });
    Route::put('/usuarios/{user}/rol', [UserController::class, 'role'])->middleware('can:roles.manage')->name('users.role');
});

Route::middleware('can:categories.manage')->group(function () {
    Route::get('/categorias', [CategoryController::class, 'index'])->name('categories.index');
    Route::post('/categorias', [CategoryController::class, 'store'])->name('categories.store');
    Route::put('/categorias/{category}', [CategoryController::class, 'update'])->name('categories.update');
    Route::delete('/categorias/{category}', [CategoryController::class, 'destroy'])->name('categories.destroy');
    Route::post('/categorias/{category}/mover', [CategoryController::class, 'move'])->name('categories.move');
});

Route::middleware('can:moderation.manage')->group(function () {
    Route::get('/moderacion', [ModerationController::class, 'index'])->name('moderation.index');
    Route::post('/moderacion/{report}/resolver', [ModerationController::class, 'resolve'])->name('moderation.resolve');
    Route::post('/moderacion/{report}/suspender-radio', [ModerationController::class, 'suspendStation'])
        ->middleware('can:stations.suspend')
        ->name('moderation.suspend-station');
    Route::post('/moderacion/{report}/ocultar-mensaje', [ModerationController::class, 'hideMessage'])->name('moderation.hide-message');
});

Route::get('/auditoria', AuditLogController::class)->middleware('can:audit.view')->name('audit');
