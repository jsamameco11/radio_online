<?php

namespace App\Domain\Stories\Support;

use Illuminate\Http\Request;

/** Who is watching stories: "u:{id}" for a signed-in user, a hash of the session for a guest. */
final class StoryViewer
{
    public static function key(Request $request): string
    {
        $user = $request->user();
        if ($user !== null) {
            return 'u:'.$user->getKey();
        }

        return 'g:'.substr(hash('sha256', $request->session()->getId()), 0, 62);
    }
}
