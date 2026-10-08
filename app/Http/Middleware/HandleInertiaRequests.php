<?php

namespace App\Http\Middleware;

use App\Domain\Access\Enums\Permission;
use App\Domain\Platform\PlatformHost;
use App\Domain\Platform\PlatformSettings;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Stations\Support\StationSetup;
use App\Domain\Storage\MediaStorage;
use App\Http\Resources\StationResource;
use App\Models\Station;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'app' => [
                'name' => config('platform.name'),
                'host' => PlatformHost::of($request)->value,
                'urls' => config('platform.urls'),
                'currency' => config('platform.wallet.currency'),
            ],
            'auth' => [
                'user' => $user ? $this->userPayload($user) : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'status' => fn () => $request->session()->get('status'),
            ],
            'studio' => fn () => $user ? $this->studioPayload($request, $user) : null,
            'notice' => fn () => app(PlatformSettings::class)->get('maintenance_banner'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'avatar_url' => app(MediaStorage::class)->url($user->avatar_path),
            'email_verified' => $user->hasVerifiedEmail(),
            'two_factor_enabled' => $user->hasTwoFactorEnabled(),
            'is_staff' => $user->isStaff(),
            'roles' => $user->getRoleNames()->values()->all(),
            'permissions' => array_values(array_map(
                fn (Permission $permission) => $permission->value,
                $user->isSuperAdmin()
                    ? Permission::cases()
                    : array_filter(Permission::cases(), fn (Permission $permission) => $user->checkPermissionTo($permission->value)),
            )),
            'has_studio' => $user->hasStudio(),
        ];
    }

    /**
     * The station whose studio is open, with what this user may do in it.
     *
     * @return array<string, mixed>|null
     */
    private function studioPayload(Request $request, User $user): ?array
    {
        $current = app(CurrentStation::class);
        if (! $current->has()) {
            return null;
        }

        $station = $current->get()->loadMissing(['frequency', 'categories', 'hashtags', 'currentTopic.hashtags']);
        $role = $user->roleIn($station);
        $everything = $user->can(Permission::EnterAnyStudio->value);

        return [
            'station' => StationResource::make($station)->resolve($request),
            'role' => $role?->value,
            'role_label' => $role?->label() ?? 'Supervisión de plataforma',
            'permissions' => array_values(array_map(
                fn (StationPermission $permission) => $permission->value,
                array_filter(StationPermission::cases(), fn (StationPermission $permission) => $everything || $user->canInStation($station, $permission)),
            )),
            'setup' => app(StationSetup::class)->steps($station, $user, $everything),
            'stations' => $user->stations()
                ->join('frequencies', 'frequencies.id', '=', 'stations.frequency_id')
                ->get(['stations.name', 'frequencies.label', 'frequencies.slug'])
                ->map(fn (Station $own) => ['name' => $own->name, 'frequency' => $own->getAttribute('label'), 'slug' => $own->getAttribute('slug')])
                ->values()
                ->all(),
        ];
    }
}
