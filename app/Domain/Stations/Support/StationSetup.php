<?php

namespace App\Domain\Stations\Support;

use App\Domain\Stations\Enums\StationPermission;
use App\Models\Station;
use App\Models\User;

/**
 * "Pon a punto tu radio": what a new station still needs, shown across its studio.
 * Reads the station's categories, hashtags and members_count (ResolveStudioStation counts the members).
 */
final class StationSetup
{
    /**
     * The steps this member can complete, in order.
     *
     * @return list<array{key: string, label: string, done: bool, href: string}>
     */
    public function steps(Station $station, User $user, bool $everything = false): array
    {
        $members = $station->members_count ?? $station->members()->count();

        $steps = [
            ['logo', 'Sube el logo de tu canal', $station->logo_path !== null, '/perfil', StationPermission::EditProfile],
            ['cover', 'Sube tu foto de portada', $station->cover_path !== null, '/perfil#portada', StationPermission::EditProfile],
            ['description', 'Escribe la descripción de tu canal (obligatoria)', $station->hasDescription(), '/perfil#descripcion', StationPermission::EditProfile],
            ['categories', 'Elige las categorías de tu canal', $station->categories->isNotEmpty(), '/perfil', StationPermission::EditProfile],
            ['hashtags', 'Agrega hashtags para que te encuentren', $station->hashtags->isNotEmpty(), '/perfil', StationPermission::EditProfile],
            ['team', 'Invita a tu equipo', $members > 1, '/configuracion/equipo', StationPermission::ManageMembers],
        ];

        return array_values(array_map(
            fn (array $step) => ['key' => $step[0], 'label' => $step[1], 'done' => $step[2], 'href' => $step[3]],
            array_filter($steps, fn (array $step) => $everything || $user->canInStation($station, $step[4])),
        ));
    }
}
