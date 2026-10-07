<?php

use App\Http\Controllers\Studio\GrowthController;
use App\Http\Controllers\Studio\MonetizationController;
use App\Http\Controllers\Studio\WithdrawalController;
use Illuminate\Support\Facades\Route;

/*
| Studio › goals and growth, monetization request and withdrawals
| (/estudio/{frequency}/…, names "studio.*").
*/

Route::get('/crecimiento', GrowthController::class)->middleware('studio.can:analytics.view')->name('growth');

Route::middleware('studio.can:finance.withdraw')->group(function () {
    Route::get('/monetizacion', [MonetizationController::class, 'index'])->name('monetization');
    Route::post('/monetizacion/solicitud', [MonetizationController::class, 'store'])->name('monetization.request');
    Route::post('/monetizacion/retiros', [WithdrawalController::class, 'store'])->name('withdrawals.store');
});
