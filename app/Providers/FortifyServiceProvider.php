<?php

namespace App\Providers;

use App\Actions\Fortify\UpdateUserPassword;
use App\Actions\Fortify\UpdateUserProfileInformation;
use App\Domain\Access\Actions\AuthenticateStaff;
use App\Domain\Platform\PlatformHost;
use App\Http\Responses\LoginResponse;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Laravel\Fortify\Actions\RedirectIfTwoFactorAuthenticatable;
use Laravel\Fortify\Contracts\LoginResponse as LoginResponseContract;
use Laravel\Fortify\Fortify;

/**
 * Listeners and creators sign in with Google (see GoogleController); the username and password
 * form only answers on the control host, for the platform staff.
 */
class FortifyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(LoginResponseContract::class, LoginResponse::class);
    }

    public function boot(): void
    {
        Fortify::updateUserProfileInformationUsing(UpdateUserProfileInformation::class);
        Fortify::updateUserPasswordsUsing(UpdateUserPassword::class);
        Fortify::redirectUserForTwoFactorAuthenticationUsing(RedirectIfTwoFactorAuthenticatable::class);

        Fortify::authenticateUsing(fn (Request $request): ?User => $this->staffSigningIn($request));

        $this->registerViews();
        $this->registerRateLimiters();
    }

    /**
     * Fortify asks twice per sign-in (the two-factor check, then the sign-in itself);
     * the username and password are verified once per request.
     */
    private function staffSigningIn(Request $request): ?User
    {
        if (PlatformHost::of($request) !== PlatformHost::Control) {
            return null;
        }

        if (! $request->attributes->has('staff')) {
            $request->attributes->set('staff', $this->app->make(AuthenticateStaff::class)->handle(
                $request->string(Fortify::username())->toString(),
                $request->string('password')->toString(),
            ));
        }

        return $request->attributes->get('staff');
    }

    private function registerViews(): void
    {
        Fortify::loginView(function (Request $request) {
            $this->rememberWayBack($request);

            return Inertia::render('Auth/Login', [
                'status' => $request->session()->get('status'),
            ]);
        });

        Fortify::verifyEmailView(fn (Request $request) => Inertia::render('Auth/VerifyEmail', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::twoFactorChallengeView(fn () => Inertia::render('Auth/TwoFactorChallenge'));

        Fortify::confirmPasswordView(fn () => Inertia::render('Auth/ConfirmPassword'));
    }

    /**
     * "/ingresar?volver=/radio/89-30": a guest who wanted to follow, gift or chat returns to that
     * page once signed in. Only paths of the same host are accepted.
     */
    private function rememberWayBack(Request $request): void
    {
        $path = $request->string('volver')->toString();

        if (preg_match('#^/(?![/\\\\])#', $path) === 1) {
            redirect()->setIntendedUrl(url($path));
        }
    }

    private function registerRateLimiters(): void
    {
        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });

        RateLimiter::for('two-factor', function (Request $request) {
            return Limit::perMinute(5)->by($request->session()->get('login.id'));
        });
    }
}
