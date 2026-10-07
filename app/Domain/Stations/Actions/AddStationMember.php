<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Notifications\AddedToStationTeam;
use App\Domain\Stations\Support\StationLinks;
use App\Models\Station;
use App\Models\StationMember;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/** Adds an existing account to the station team with a role other than owner. */
final class AddStationMember
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Station $station, string $email, StationRole $role, User $actor): StationMember
    {
        if ($role === StationRole::Owner) {
            throw ValidationException::withMessages(['role' => 'Una emisora tiene un solo propietario: usa la transferencia de propiedad.']);
        }

        $user = User::query()->whereRaw('lower(email) = ?', [mb_strtolower(trim($email))])->first();

        if ($user === null) {
            throw ValidationException::withMessages(['email' => 'No encontramos una cuenta con ese correo. Pídele que se registre primero.']);
        }

        if ($user->isSuspended()) {
            throw ValidationException::withMessages(['email' => 'Esa cuenta está suspendida.']);
        }

        if ($station->members()->where('user_id', $user->id)->exists()) {
            throw ValidationException::withMessages(['email' => 'Esa persona ya forma parte del equipo.']);
        }

        $member = $station->members()->create(['user_id' => $user->id, 'role' => $role]);

        $this->audit->record('station.member_added', $station, ['user_id' => $user->id, 'role' => $role->value], $actor);
        $user->notify(new AddedToStationTeam(
            $station->id,
            $station->displayName(),
            $role->label(),
            $actor->name,
            StationLinks::studio($station),
        ));

        return $member->setRelation('user', $user);
    }
}
