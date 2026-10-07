<?php

namespace App\Http\Middleware;

use App\Domain\Access\Enums\Permission;
use App\Domain\Platform\PlatformSettings;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaStorage;
use App\Http\Resources\StationResource;
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
                'host' => $this->hostKind($request),
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

    /** "public" or "control": which of the two applications answered. */
    private function hostKind(Request $request): string
    {
        return strtolower($request->getHost()) === strtolower((string) config('platform.hosts.control')) ? 'control' : 'public';
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
            'permissions' => $user->isSuperAdmin()
                ? array_map(fn (Permission $permission) => $permission->value, Permission::cases())
                : $user->getAllPermissions()->pluck('name')->values()->all(),
            'has_studio' => $user->memberships()->exists(),
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
            'stations' => $user->stations()
                ->with('frequency')
                ->get()
                ->map(fn ($own) => ['name' => $own->name, 'frequency' => $own->frequency->label, 'slug' => $own->frequency->slug])
                ->values()
                ->all(),
        ];
    }
}
