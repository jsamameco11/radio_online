<?php

use App\Domain\Stations\Actions\ReplaceStationImage;
use App\Http\Controllers\Studio\AnalyticsController;
use App\Http\Controllers\Studio\Settings\FrequencySettingsController;
use App\Http\Controllers\Studio\Settings\GeneralSettingsController;
use App\Http\Controllers\Studio\Settings\PreferenceSettingsController;
use App\Http\Controllers\Studio\Settings\SecuritySettingsController;
use App\Http\Controllers\Studio\Settings\TeamController;
use App\Http\Controllers\Studio\StationDashboardController;
use App\Http\Controllers\Studio\StationProfileController;
use App\Http\Controllers\Studio\TopicController;
use Illuminate\Support\Facades\Route;

Route::get('/', StationDashboardController::class)->name('dashboard');

Route::middleware('studio.can:station.profile')->group(function () {
    Route::get('/perfil', [StationProfileController::class, 'edit'])->name('profile');
    Route::put('/perfil', [StationProfileController::class, 'update'])->name('profile.update');
    Route::post('/perfil/imagenes/{slot}', [StationProfileController::class, 'image'])
        ->whereIn('slot', array_keys(ReplaceStationImage::SLOTS))
        ->name('profile.image');
    Route::delete('/perfil/imagenes/{slot}', [StationProfileController::class, 'destroyImage'])
        ->whereIn('slot', array_keys(ReplaceStationImage::SLOTS))
        ->name('profile.image.destroy');
});

Route::middleware('studio.can:console.operate')->group(function () {
    Route::get('/tema', [TopicController::class, 'index'])->name('topic');
    Route::post('/tema', [TopicController::class, 'store'])->name('topic.store');
    Route::put('/tema', [TopicController::class, 'update'])->name('topic.update');
    Route::delete('/tema', [TopicController::class, 'destroy'])->name('topic.destroy');
});

Route::middleware('studio.can:analytics.view')->group(function () {
    Route::get('/estadisticas', [AnalyticsController::class, 'stats'])->name('stats');
    Route::get('/audiencia', [AnalyticsController::class, 'audience'])->name('audience');
});

Route::middleware('studio.can:station.settings')->group(function () {
    Route::get('/configuracion', [GeneralSettingsController::class, 'edit'])->name('settings');
    Route::put('/configuracion', [GeneralSettingsController::class, 'update'])->name('settings.update');

    Route::get('/configuracion/frecuencia', [FrequencySettingsController::class, 'show'])->name('settings.frequency');
    Route::post('/configuracion/frecuencia', [FrequencySettingsController::class, 'store'])->name('settings.frequency.request');
    Route::delete('/configuracion/frecuencia/solicitudes/{frequencyRequest}', [FrequencySettingsController::class, 'destroy'])
        ->name('settings.frequency.cancel');

    Route::get('/configuracion/moderacion', [PreferenceSettingsController::class, 'moderation'])->name('settings.moderation');
    Route::put('/configuracion/moderacion', [PreferenceSettingsController::class, 'updateModeration'])->name('settings.moderation.update');
    Route::get('/configuracion/notificaciones', [PreferenceSettingsController::class, 'notifications'])->name('settings.notifications');
    Route::put('/configuracion/notificaciones', [PreferenceSettingsController::class, 'updateNotifications'])->name('settings.notifications.update');
    Route::get('/configuracion/privacidad', [PreferenceSettingsController::class, 'privacy'])->name('settings.privacy');
    Route::put('/configuracion/privacidad', [PreferenceSettingsController::class, 'updatePrivacy'])->name('settings.privacy.update');

    Route::get('/configuracion/equipo', [TeamController::class, 'index'])->name('settings.team');
    Route::get('/configuracion/seguridad', [SecuritySettingsController::class, 'show'])->name('settings.security');
    Route::post('/configuracion/seguridad/transferir', [SecuritySettingsController::class, 'transfer'])->name('settings.security.transfer');
    Route::post('/configuracion/seguridad/cerrar', [SecuritySettingsController::class, 'close'])->name('settings.security.close');
});

Route::middleware('studio.can:station.members')->group(function () {
    Route::post('/configuracion/equipo', [TeamController::class, 'store'])->name('settings.team.store');
    Route::put('/configuracion/equipo/{member}', [TeamController::class, 'update'])->name('settings.team.update');
    Route::delete('/configuracion/equipo/{member}', [TeamController::class, 'destroy'])->name('settings.team.destroy');
    Route::put('/configuracion/seguridad', [SecuritySettingsController::class, 'update'])->name('settings.security.update');
});
