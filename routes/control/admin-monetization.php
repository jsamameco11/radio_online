<?php

use App\Http\Controllers\Admin\FrequencySaleController;
use App\Http\Controllers\Admin\MonetizationRequestController;
use App\Http\Controllers\Admin\WithdrawalController;
use Illuminate\Support\Facades\Route;

/*
| Admin › monetization requests, station withdrawals, station sales and
| frequencies the platform sells
| (/admin/…, names "admin.*").
*/

Route::middleware('can:monetization.review')->group(function () {
    Route::get('/monetizacion', [MonetizationRequestController::class, 'index'])->name('monetization.index');
    Route::post('/monetizacion/{monetizationRequest}/aprobar', [MonetizationRequestController::class, 'approve'])->name('monetization.approve');
    Route::post('/monetizacion/{monetizationRequest}/rechazar', [MonetizationRequestController::class, 'reject'])->name('monetization.reject');
});

Route::middleware('can:payouts.manage')->group(function () {
    Route::get('/retiros', [WithdrawalController::class, 'index'])->name('withdrawals.index');
    Route::post('/retiros/{withdrawalRequest}/pagado', [WithdrawalController::class, 'pay'])->name('withdrawals.pay');
    Route::post('/retiros/{withdrawalRequest}/rechazar', [WithdrawalController::class, 'reject'])->name('withdrawals.reject');

    Route::get('/ventas', [FrequencySaleController::class, 'index'])->name('sales.index');
    Route::post('/ventas/{listing}/pagado', [FrequencySaleController::class, 'pay'])->name('sales.pay');
});

Route::post('/ventas/frecuencias', [FrequencySaleController::class, 'store'])
    ->middleware(['can:payouts.manage', 'can:frequencies.assign', 'throttle:30,1'])
    ->name('sales.store');

Route::post('/ventas/{listing}/retirar', [FrequencySaleController::class, 'withdraw'])
    ->middleware(['can:payouts.manage', 'can:stations.update'])
    ->name('sales.withdraw');
