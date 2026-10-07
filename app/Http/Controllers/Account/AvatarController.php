<?php

namespace App\Http\Controllers\Account;

use App\Domain\Access\Actions\ChangeAvatar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Account\UpdateAvatarRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class AvatarController extends Controller
{
    public function update(UpdateAvatarRequest $request, ChangeAvatar $change): RedirectResponse
    {
        $change->handle($request->user(), $request->file('avatar'));

        return back()->with('success', 'Actualizamos tu foto de perfil.');
    }

    public function destroy(Request $request, ChangeAvatar $change): RedirectResponse
    {
        $change->handle($request->user(), null);

        return back()->with('success', 'Quitamos tu foto de perfil.');
    }
}
