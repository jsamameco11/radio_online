<?php

use App\Http\Controllers\Account\AvatarController;
use App\Http\Controllers\Account\PasswordController;
use App\Http\Controllers\Account\ProfileController;
use App\Http\Controllers\Account\SecurityController;
use App\Http\Controllers\Account\SessionController;
use Illuminate\Support\Facades\Route;

/*
| Profile and security pages, on both hosts. The password and two-factor
| changes themselves are Fortify endpoints (config/fortify.php paths).
*/

Route::middleware('auth')->prefix('cuenta')->name('account.')->group(function () {
    Route::get('/perfil', [ProfileController::class, 'edit'])->name('profile');
    Route::patch('/perfil', [ProfileController::class, 'update'])->name('profile.update');
    Route::post('/perfil/foto', [AvatarController::class, 'update'])->middleware('throttle:10,1')->name('avatar.update');
    Route::delete('/perfil/foto', [AvatarController::class, 'destroy'])->name('avatar.destroy');

    Route::get('/seguridad', [SecurityController::class, 'show'])->name('security');
    Route::post('/clave/crear', [PasswordController::class, 'store'])->middleware('throttle:6,1')->name('password.store');
    Route::get('/seguridad/codigos', [SecurityController::class, 'recoveryCodes'])->middleware('password.confirm')->name('security.recovery-codes');
    Route::delete('/sesiones', [SessionController::class, 'destroyOthers'])->middleware('throttle:6,1')->name('sessions.destroy');
});
