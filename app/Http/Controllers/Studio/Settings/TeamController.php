<?php

namespace App\Http\Controllers\Studio\Settings;

use App\Domain\Stations\Actions\AddStationMember;
use App\Domain\Stations\Actions\ChangeMemberRole;
use App\Domain\Stations\Actions\RemoveStationMember;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Support\CurrentStation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Stations\AddStationMemberRequest;
use App\Http\Requests\Stations\ChangeStationMemberRoleRequest;
use App\Http\Resources\Stations\StationMemberResource;
use App\Models\StationMember;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio > Configuración > Equipo: who works on the station and with which role. */
class TeamController extends Controller
{
    public function __construct(private readonly CurrentStation $current) {}

    public function index(Request $request): Response
    {
        $station = $this->current->get();
        $members = StationMember::query()
            ->where('station_id', $station->id)
            ->with('user')
            ->get()
            ->sortBy(fn (StationMember $member) => [array_search($member->role, StationRole::cases(), true), $member->user->name])
            ->values();

        return Inertia::render('Studio/Settings/Team', [
            'members' => $members->map(fn (StationMember $member) => StationMemberResource::make($member)->resolve($request))->all(),
            'roles' => collect(StationRole::cases())
                ->reject(fn (StationRole $role) => $role === StationRole::Owner)
                ->map(fn (StationRole $role) => [
                    'value' => $role->value,
                    'label' => $role->label(),
                    'permissions' => array_map(fn (StationPermission $permission) => $permission->value, $role->permissions()),
                ])
                ->values()
                ->all(),
            'canManage' => $request->user()->canInStation($station, StationPermission::ManageMembers),
        ]);
    }

    public function store(AddStationMemberRequest $request, AddStationMember $add): RedirectResponse
    {
        $member = $add->handle($this->current->get(), (string) $request->validated('email'), $request->role(), $request->user());

        return back()->with('success', "{$member->user->name} ya es parte del equipo.");
    }

    public function update(ChangeStationMemberRoleRequest $request, StationMember $member, ChangeMemberRole $change): RedirectResponse
    {
        Gate::authorize('update', $this->ownMember($member));
        $change->handle($this->current->get(), $member, $request->role(), $request->user());

        return back()->with('success', "{$member->user->name} ahora es {$request->role()->label()}.");
    }

    public function destroy(Request $request, StationMember $member, RemoveStationMember $remove): RedirectResponse
    {
        Gate::authorize('delete', $this->ownMember($member));
        $remove->handle($this->current->get(), $member, $request->user());

        return back()->with('success', "{$member->user->name} ya no es parte del equipo.");
    }

    /** The member, only when it belongs to the station of this studio. */
    private function ownMember(StationMember $member): StationMember
    {
        abort_unless((int) $member->station_id === $this->current->id(), 404);

        return $member->setRelation('station', $this->current->get())->load('user');
    }
}
