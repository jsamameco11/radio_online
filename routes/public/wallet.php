<?php

use App\Http\Controllers\Public\GiftController;
use App\Http\Controllers\Public\TopUpController;
use App\Http\Controllers\Public\WalletController;
use Illuminate\Support\Facades\Route;

/*
| Listener wallet and gifts (public host). Money never moves without a
| verified account; the amounts are always checked again in the backend.
*/

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/billetera', [WalletController::class, 'show'])->name('wallet');
    Route::get('/billetera/saldo', [WalletController::class, 'balance'])->name('wallet.balance');

    Route::post('/billetera/recargar', [TopUpController::class, 'store'])
        ->middleware('throttle:10,1')
        ->name('wallet.topup');
    Route::get('/billetera/recarga/{payment}', [TopUpController::class, 'show'])->name('wallet.topup.show');
    Route::post('/billetera/recarga/{payment}/cargo', [TopUpController::class, 'charge'])
        ->middleware('throttle:20,1')
        ->name('wallet.topup.charge');

    Route::get('/radio/{frequency}/regalos', [GiftController::class, 'catalog'])->name('gifts.catalog');
    Route::post('/radio/{frequency}/regalos', [GiftController::class, 'store'])
        ->middleware('throttle:30,1')
        ->name('gifts.send');
});
