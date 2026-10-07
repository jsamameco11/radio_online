<?php

namespace App\Http\Requests\Concerns;

use App\Models\Playlist;
use Illuminate\Validation\ValidationException;

/** Forms that choose the playlist of the automatic music: none means random songs. */
trait ChoosesPlaylist
{
    public function playlist(): ?Playlist
    {
        $id = $this->validated('playlist');
        if ($id === null || $id === '') {
            return null;
        }

        return Playlist::query()->find($id)
            ?? throw ValidationException::withMessages(['playlist' => 'Esa lista de reproducción ya no existe.']);
    }
}
