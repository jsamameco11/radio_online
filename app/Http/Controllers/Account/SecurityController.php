<?php

namespace App\Http\Controllers\Account;

use App\Domain\Access\AccountSessions;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Fortify;

/**
 * Password, two-factor authentication and signed-in browsers. Listeners and creators sign in
 * with Google: their password only confirms sensitive actions. The staff signs in to the control
 * panel with its username and password. The changes go to the Fortify endpoints, passed to the
 * page by route name.
 */
class SecurityController extends Controller
{
    public function show(Request $request, AccountSessions $sessions): Response
    {
        $justIssued = in_array($request->session()->get('status'), [
            Fortify::TWO_FACTOR_AUTHENTICATION_CONFIRMED,
            Fortify::RECOVERY_CODES_GENERATED,
        ], true);

        return $this->render($request, $sessions, $justIssued);
    }

    /** Shows the recovery codes again; the route asks for the password first. */
    public function recoveryCodes(Request $request, AccountSessions $sessions): Response
    {
        return $this->render($request, $sessions, true);
    }

    private function render(Request $request, AccountSessions $sessions, bool $withRecoveryCodes): Response
    {
        $user = $request->user();
        $pending = $user->two_factor_secret !== null && $user->two_factor_confirmed_at === null;
        $enabled = $user->hasTwoFactorEnabled();

        return Inertia::render('Account/Security', [
            'twoFactor' => [
                'enabled' => $enabled,
                'pending' => $pending,
                'confirmed_at' => $user->two_factor_confirmed_at?->toIso8601String(),
                'qr_svg' => $pending ? $user->twoFactorQrCodeSvg() : null,
                'secret' => $pending ? $this->secret($user) : null,
                'recovery_codes' => $enabled && $withRecoveryCodes ? $user->recoveryCodes() : null,
            ],
            'signIn' => [
                'has_password' => $user->getAuthPassword() !== null,
                'google_linked' => $user->google_id !== null,
                'staff_username' => $user->isStaff() ? $user->username : null,
            ],
            'sessions' => $sessions->of($user, $request->session()->getId(), $request->ip(), $request->userAgent()),
            'endpoints' => [
                'password' => route('user-password.update', absolute: false),
                'set_password' => route('account.password.store', absolute: false),
                'two_factor' => route('two-factor.enable', absolute: false),
                'two_factor_confirm' => route('two-factor.confirm', absolute: false),
                'recovery_codes' => route('two-factor.regenerate-recovery-codes', absolute: false),
                'confirm_password' => route('password.confirm.store', absolute: false),
                'password_status' => route('password.confirmation', absolute: false),
            ],
        ]);
    }

    private function secret(User $user): string
    {
        return (string) Fortify::currentEncrypter()->decrypt($user->two_factor_secret);
    }
}
