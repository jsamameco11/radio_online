<?php

namespace App\Policies;

use App\Domain\Stations\Support\CurrentStation;
use App\Models\Genre;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/** The catalog is shared: a station only changes or deletes the genres it added itself. */
class GenrePolicy
{
    public function __construct(private readonly CurrentStation $current) {}

    public function update(User $user, Genre $genre): Response
    {
        return $this->owned($genre);
    }

    public function delete(User $user, Genre $genre): Response
    {
        return $this->owned($genre);
    }

    private function owned(Genre $genre): Response
    {
        return $genre->ownedBy($this->current->id())
            ? Response::allow()
            : Response::deny('Este estilo es del catálogo compartido: solo la radio que lo agregó puede cambiarlo.');
    }
}
