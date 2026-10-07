<?php

use App\Http\Controllers\Admin\GiftCatalogController;
use App\Http\Controllers\Admin\LedgerController;
use App\Http\Controllers\Admin\PaymentController;
use Illuminate\Support\Facades\Route;

/*
| Platform finances (/admin/…, names "admin.*"): the gift catalog, wallet
| top-ups and the ledger of every wallet. Staff only.
*/

Route::middleware('can:gifts.manage')->group(function () {
    Route::get('/regalos', [GiftCatalogController::class, 'index'])->name('gifts.index');
    Route::post('/regalos', [GiftCatalogController::class, 'store'])->name('gifts.store');
    Route::put('/regalos/{gift}', [GiftCatalogController::class, 'update'])->name('gifts.update');
    Route::delete('/regalos/{gift}', [GiftCatalogController::class, 'destroy'])->name('gifts.destroy');
});

Route::middleware('can:payments.view')->group(function () {
    Route::get('/pagos', [PaymentController::class, 'index'])->name('payments.index');
    Route::post('/pagos/{payment}/reembolso', [PaymentController::class, 'refund'])->name('payments.refund');

    Route::get('/movimientos', [LedgerController::class, 'index'])->name('ledger.index');
});

Route::post('/movimientos/ajustes', [LedgerController::class, 'adjust'])
    ->middleware('can:wallets.adjust')
    ->name('ledger.adjust');
