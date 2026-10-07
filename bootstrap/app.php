<?php

use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\EnsureControlAccess;
use App\Http\Middleware\EnsureStaffTwoFactor;
use App\Http\Middleware\EnsureStudioPermission;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\ResolveStudioStation;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        using: function () {
            // Payment providers call without session or CSRF token.
            Route::group([], base_path('routes/webhooks.php'));

            Route::middleware('web')->group(function () {
                // Sign-in, profile and security pages answer on both hosts.
                Route::group([], base_path('routes/account.php'));

                Route::domain(config('platform.hosts.public'))->group(function () {
                    Route::group([], base_path('routes/public/site.php'));
                    Route::group([], base_path('routes/public/listen.php'));
                    Route::group([], base_path('routes/public/wallet.php'));
                });

                Route::domain(config('platform.hosts.control'))
                    ->middleware(['auth', 'verified', EnsureControlAccess::class])
                    ->group(function () {
                        Route::group([], base_path('routes/control/home.php'));

                        Route::prefix('admin')->name('admin.')->middleware(EnsureStaffTwoFactor::class)->group(function () {
                            Route::group([], base_path('routes/control/admin.php'));
                            Route::group([], base_path('routes/control/admin-finance.php'));
                        });

                        Route::prefix('estudio/{studio}')->name('studio.')->middleware(ResolveStudioStation::class)->group(function () {
                            Route::group([], base_path('routes/studio/station.php'));
                            Route::group([], base_path('routes/studio/console.php'));
                            Route::group([], base_path('routes/studio/media.php'));
                            Route::group([], base_path('routes/studio/gifts.php'));
                        });
                    });
            });
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            EnsureAccountIsActive::class,
            HandleInertiaRequests::class,
        ]);

        $middleware->alias([
            'studio.can' => EnsureStudioPermission::class,
        ]);

        $middleware->redirectGuestsTo('/ingresar');
        $middleware->redirectUsersTo('/');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
