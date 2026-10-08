<?php

namespace App\Policies;

use App\Domain\Stations\Support\CurrentStation;
use App\Models\Artist;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/** The catalog is shared: a station only changes or deletes the artists it added or learned from its songs. */
class ArtistPolicy
{
    public function __construct(private readonly CurrentStation $current) {}

    public function update(User $user, Artist $artist): Response
    {
        return $this->owned($artist);
    }

    public function delete(User $user, Artist $artist): Response
    {
        return $this->owned($artist);
    }

    private function owned(Artist $artist): Response
    {
        return $artist->ownedBy($this->current->id())
            ? Response::allow()
            : Response::deny('Este artista es del catálogo compartido: solo la radio que lo agregó puede cambiarlo.');
    }
}
