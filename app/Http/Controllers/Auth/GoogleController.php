<?php

namespace App\Http\Controllers\Auth;

use App\Domain\Access\Actions\SignInWithGoogle;
use App\Domain\Access\Enums\GoogleSignInOutcome;
use App\Domain\Access\Exceptions\GoogleSignInRefused;
use App\Http\Controllers\Controller;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\InvalidStateException;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirect;

/** "Continuar con Google" on either host: the callback answers on the host that started it. */
class GoogleController extends Controller
{
    public function redirect(): SymfonyRedirect
    {
        return $this->provider()->with(['prompt' => 'select_account'])->redirect();
    }

    public function callback(Request $request, SignInWithGoogle $signIn): RedirectResponse
    {
        if ($request->filled('error')) {
            throw GoogleSignInRefused::cancelled();
        }

        try {
            $google = $this->provider()->user();
        } catch (InvalidStateException|GuzzleException) {
            throw GoogleSignInRefused::failed();
        }

        return match ($signIn->handle($google, $request->session())) {
            GoogleSignInOutcome::TwoFactorChallenge => redirect()->route('two-factor.login'),
            GoogleSignInOutcome::SignedIn => redirect()->intended((string) config('fortify.home')),
        };
    }

    private function provider(): AbstractProvider
    {
        if (blank(config('services.google.client_id')) || blank(config('services.google.client_secret'))) {
            throw GoogleSignInRefused::unavailable();
        }

        return Socialite::driver('google')->redirectUrl(url((string) config('services.google.redirect')));
    }
}
