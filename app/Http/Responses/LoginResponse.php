<?php

namespace App\Http\Responses;

use App\Domain\Platform\PlatformHost;
use Laravel\Fortify\Contracts\LoginResponse as LoginResponseContract;
use Laravel\Fortify\Fortify;

/**
 * After the username and password sign-in: back to the page the visitor wanted, otherwise
 * straight to the panel on the control host (one redirect less than going through "/").
 */
final class LoginResponse implements LoginResponseContract
{
    public function toResponse($request)
    {
        if ($request->wantsJson()) {
            return response()->json(['two_factor' => false]);
        }

        return redirect()->intended(PlatformHost::of($request) === PlatformHost::Control
            ? route('admin.dashboard')
            : Fortify::redirects('login'));
    }
}
