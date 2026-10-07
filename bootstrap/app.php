<?php

use App\Domain\Frequencies\FrequencyDial;
use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\EnsureControlAccess;
use App\Http\Middleware\EnsureStaffTwoFactor;
use App\Http\Middleware\EnsureStationTwoFactor;
use App\Http\Middleware\EnsureStudioAccess;
use App\Http\Middleware\EnsureStudioPermission;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\ResolveStudioStation;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Events\DiagnosingHealth;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        using: function () {
            // Uptime probe on every host, without session.
            Route::get('/up', function () {
                Event::dispatch(new DiagnosingHealth);

                return response('OK');
            });

            // Payment providers call without session or CSRF token.
            Route::group([], base_path('routes/webhooks.php'));

            Route::middleware('web')->group(function () {
                // Sign-in, profile and security pages answer on every host.
                Route::group([], base_path('routes/account.php'));
                Route::group([], base_path('routes/auth.php'));

                Route::domain(config('platform.hosts.public'))->group(function () {
                    Route::group([], base_path('routes/public/site.php'));
                    Route::group([], base_path('routes/public/apply.php'));
                    Route::group([], base_path('routes/public/listen.php'));
                    Route::group([], base_path('routes/public/wallet.php'));
                    Route::group([], base_path('routes/public/chat.php'));
                });

                Route::domain(config('platform.hosts.studio'))
                    ->middleware(['auth', 'verified', EnsureStudioAccess::class])
                    ->group(function () {
                        Route::group([], base_path('routes/studio/home.php'));

                        Route::prefix('{studio}')
                            ->where(['studio' => FrequencyDial::SLUG_PATTERN])
                            ->name('studio.')
                            ->middleware([ResolveStudioStation::class, EnsureStationTwoFactor::class])
                            ->group(function () {
                                Route::group([], base_path('routes/studio/station.php'));
                                Route::group([], base_path('routes/studio/console.php'));
                                Route::group([], base_path('routes/studio/media.php'));
                                Route::group([], base_path('routes/studio/gifts.php'));
                                Route::group([], base_path('routes/studio/chat.php'));
                                Route::group([], base_path('routes/studio/growth.php'));
                            });
                    });

                Route::domain(config('platform.hosts.control'))->group(function () {
                    Route::group([], base_path('routes/control/legacy.php'));

                    Route::middleware(['auth', 'verified', EnsureControlAccess::class])->group(function () {
                        Route::group([], base_path('routes/control/home.php'));

                        Route::prefix('admin')->name('admin.')->middleware(EnsureStaffTwoFactor::class)->group(function () {
                            Route::group([], base_path('routes/control/admin.php'));
                            Route::group([], base_path('routes/control/admin-finance.php'));
                            Route::group([], base_path('routes/control/admin-applications.php'));
                            Route::group([], base_path('routes/control/admin-monetization.php'));
                        });
                    });
                });
            });
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Cloudflare sits in front of Apache: the visitor's IP and scheme come in its forwarded headers.
        $middleware->trustProxies(at: '*');

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
