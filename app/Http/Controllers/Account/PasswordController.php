<?php

namespace App\Http\Controllers\Account;

use App\Domain\Access\Actions\SetPassword;
use App\Http\Controllers\Controller;
use App\Http\Requests\Account\SetPasswordRequest;
use Illuminate\Http\RedirectResponse;

class PasswordController extends Controller
{
    public function store(SetPasswordRequest $request, SetPassword $setPassword): RedirectResponse
    {
        $setPassword->handle($request->user(), $request->string('password')->toString());

        return back()->with('success', 'Creaste tu contraseña. Ya puedes ingresar también con tu correo.');
    }
}
