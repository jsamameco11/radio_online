<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\Enums\GoogleSignInOutcome;
use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Access\Exceptions\GoogleSignInRefused;
use App\Domain\Audit\AuditTrail;
use App\Domain\Platform\PlatformSettings;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Fortify\Events\TwoFactorAuthenticationChallenged;
use Laravel\Socialite\Contracts\User as GoogleUser;

/**
 * Signs a person in with the Google account Google just confirmed.
 *
 * The account is found by its linked Google id, else by the (verified) email,
 * else created as a listener while registrations are open. Accounts with two-factor authentication are not
 * signed in here: they go through Fortify's challenge like a password sign-in.
 */
final class SignInWithGoogle
{
    public function __construct(
        private readonly AuditTrail $audit,
        private readonly PlatformSettings $settings,
    ) {}

    /**
     * @throws GoogleSignInRefused
     */
    public function handle(GoogleUser $google, Session $session): GoogleSignInOutcome
    {
        $email = Str::lower(trim((string) $google->getEmail()));

        if ($email === '' || ! filter_var($google->getRaw()['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            throw GoogleSignInRefused::unverifiedEmail();
        }

        $user = $this->account((string) $google->getId(), $email, (string) $google->getName());

        if ($user->isSuspended()) {
            throw GoogleSignInRefused::suspended();
        }

        if ($user->hasTwoFactorEnabled()) {
            $session->put(['login.id' => $user->getKey(), 'login.remember' => false]);
            TwoFactorAuthenticationChallenged::dispatch($user);

            return GoogleSignInOutcome::TwoFactorChallenge;
        }

        Auth::guard('web')->login($user);
        $session->regenerate();

        return GoogleSignInOutcome::SignedIn;
    }

    private function account(string $googleId, string $email, string $name): User
    {
        $linked = User::query()->where('google_id', $googleId)->first();
        if ($linked !== null) {
            return $linked;
        }

        $existing = User::query()->where('email', $email)->first();
        if ($existing !== null) {
            return $this->link($existing, $googleId);
        }

        return $this->register($googleId, $email, $name);
    }

    private function link(User $user, string $googleId): User
    {
        if ($user->google_id !== null) {
            throw GoogleSignInRefused::linkedElsewhere();
        }

        $user->forceFill([
            'google_id' => $googleId,
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        $this->audit->record('user.google_linked', $user, [], $user);

        return $user;
    }

    private function register(string $googleId, string $email, string $name): User
    {
        if (! $this->settings->get('registrations_open')) {
            throw GoogleSignInRefused::registrationsClosed();
        }

        $user = DB::transaction(function () use ($googleId, $email, $name) {
            $user = User::query()->create([
                'name' => Str::limit(trim($name) !== '' ? trim($name) : Str::before($email, '@'), 80, ''),
                'email' => $email,
                'google_id' => $googleId,
            ]);
            $user->forceFill(['email_verified_at' => now()])->save();
            $user->assignRole(PlatformRole::Listener->value);

            return $user;
        });

        event(new Registered($user));
        $this->audit->record('user.registered_with_google', $user, [], $user);

        return $user;
    }
}
