<?php

namespace App\Http\Controllers\Account;

use App\Domain\Access\Actions\SignOutOtherSessions;
use App\Http\Controllers\Controller;
use App\Http\Requests\Account\SignOutOtherSessionsRequest;
use Illuminate\Http\RedirectResponse;

class SessionController extends Controller
{
    public function destroyOthers(SignOutOtherSessionsRequest $request, SignOutOtherSessions $signOut): RedirectResponse
    {
        $signOut->handle($request->user(), $request->string('password')->toString(), $request->session()->getId());

        return back()->with('success', 'Cerramos tu sesión en los demás dispositivos.');
    }
}
