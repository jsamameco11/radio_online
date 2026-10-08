<?php

namespace App\Http\Controllers\Auth;

use App\Domain\Access\Support\SessionHandoff;
use App\Domain\Platform\PlatformHost;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/** Moves between the listeners' site and the creators' console without signing in again. */
class SessionHandoffController extends Controller
{
    /** /ir/consola?a=/89-30: opens the page on the other host, signed in when the person is signed in here. */
    public function leave(Request $request, SessionHandoff $handoff, string $target): RedirectResponse
    {
        $host = SessionHandoff::TARGETS[$target];
        $path = SessionHandoff::safePath($request->query('a'));

        if ($host === PlatformHost::of($request)) {
            return redirect($path);
        }

        $user = $request->user();

        return redirect()->away($user === null ? $host->url($path) : $handoff->issue($user, $host, $path));
    }

    /** /acceso/{pass}: signs the account in on this host and opens the page; a spent pass opens the home. */
    public function arrive(Request $request, SessionHandoff $handoff, string $pass): RedirectResponse
    {
        $arrival = $handoff->redeem($pass, PlatformHost::of($request));
        if ($arrival === null) {
            return redirect('/');
        }

        if (Auth::guard('web')->id() !== $arrival['user']->getKey()) {
            Auth::guard('web')->login($arrival['user']);
            $request->session()->regenerate();
        }

        return redirect($arrival['path']);
    }
}
