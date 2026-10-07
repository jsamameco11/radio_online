<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Access\Actions\ChangePlatformRole;
use App\Domain\Access\Actions\ReactivateUser;
use App\Domain\Access\Actions\SetStaffCredentials;
use App\Domain\Access\Actions\SuspendUser;
use App\Domain\Access\Enums\Permission;
use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Access\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ChangeUserRoleRequest;
use App\Http\Requests\Admin\SuspensionRequest;
use App\Http\Requests\Admin\UpdateStaffCredentialsRequest;
use App\Http\Resources\Admin\AuditLogResource;
use App\Http\Resources\Admin\FrequencyRequestResource;
use App\Http\Resources\Admin\UserRowResource;
use App\Models\AuditLog;
use App\Models\StationMember;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Usuarios: accounts, their platform role and their standing. */
class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $q = $request->string('q')->trim()->limit(80, '')->toString();
        $role = PlatformRole::tryFrom($request->string('role')->toString());
        $status = UserStatus::tryFrom($request->string('status')->toString());

        $page = User::query()
            ->with('roles')
            ->withCount('memberships')
            ->when($q !== '', fn (Builder $query) => $query->where(fn (Builder $search) => $search
                ->where('name', 'like', "%{$q}%")
                ->orWhere('username', 'like', "%{$q}%")
                ->orWhere('email', 'like', "%{$q}%")))
            ->when($role, fn (Builder $query, PlatformRole $role) => $role === PlatformRole::Listener
                ? $query->whereDoesntHave('roles', fn (Builder $roles) => $roles->where('name', '!=', PlatformRole::Listener->value))
                : $query->role($role->value))
            ->when($status, fn (Builder $query, UserStatus $status) => $query->where('status', $status->value))
            ->latest()
            ->paginate(25)
            ->withQueryString()
            ->through(fn (User $user) => UserRowResource::make($user)->resolve($request));

        return Inertia::render('Admin/Users/Index', [
            'users' => $page,
            'filters' => ['q' => $q, 'role' => $role?->value ?? '', 'status' => $status?->value ?? ''],
            'roles' => $this->roleOptions(),
            'statuses' => collect(UserStatus::cases())->map(fn (UserStatus $item) => ['value' => $item->value, 'label' => $item->label()])->all(),
        ]);
    }

    public function show(Request $request, User $user): Response
    {
        $user->load(['roles', 'memberships.station.frequency', 'wallet']);
        $user->loadCount('memberships');
        $viewer = $request->user();

        $requests = $user->frequencyRequests()
            ->with(['user', 'reviewer', 'frequency.station', 'station.frequency'])
            ->latest()
            ->limit(10)
            ->get();
        FrequencyRequestResource::attachCategories($requests);

        return Inertia::render('Admin/Users/Show', [
            'user' => UserRowResource::make($user)->resolve($request),
            'memberships' => $user->memberships
                ->filter(fn (StationMember $member) => $member->station !== null)
                ->map(fn (StationMember $member) => [
                    'station_id' => $member->station->id,
                    'display_name' => $member->station->displayName(),
                    'station_status' => $member->station->status->value,
                    'station_status_label' => $member->station->status->label(),
                    'role' => $member->role->value,
                    'role_label' => $member->role->label(),
                    'since' => $member->created_at?->toIso8601String(),
                ])
                ->values()
                ->all(),
            'wallet' => $user->wallet === null ? null : [
                'balance_cents' => $user->wallet->balance_cents,
                'currency' => $user->wallet->currency,
                'status' => $user->wallet->status->value,
                'status_label' => $user->wallet->status->label(),
                'transactions' => WalletTransaction::query()
                    ->where('wallet_id', $user->wallet->id)
                    ->latest('created_at')
                    ->limit(10)
                    ->get()
                    ->map(fn (WalletTransaction $transaction) => [
                        'id' => $transaction->id,
                        'type' => $transaction->type->value,
                        'type_label' => $transaction->type->label(),
                        'amount_cents' => $transaction->amount_cents,
                        'balance_after_cents' => $transaction->balance_after_cents,
                        'description' => $transaction->description,
                        'created_at' => $transaction->created_at?->toIso8601String(),
                    ])
                    ->all(),
            ],
            'requests' => $requests->map(fn ($item) => FrequencyRequestResource::make($item)->resolve($request))->all(),
            'audit' => $viewer->can(Permission::ViewAudit->value)
                ? AuditLog::query()
                    ->where(fn (Builder $query) => $query
                        ->where('actor_id', $user->id)
                        ->orWhere(fn (Builder $subject) => $subject->where('subject_type', $user->getMorphClass())->where('subject_id', (string) $user->id)))
                    ->with(['actor', 'station.frequency'])
                    ->latest('created_at')
                    ->limit(20)
                    ->get()
                    ->map(fn (AuditLog $log) => AuditLogResource::make($log)->resolve($request))
                    ->all()
                : null,
            'roles' => $this->roleOptions(),
            'can' => [
                'manage' => $viewer->can(Permission::ManageUsers->value) && ! $viewer->is($user) && ($viewer->isSuperAdmin() || ! $user->isSuperAdmin()),
                'changeRole' => $viewer->can(Permission::ManageRoles->value) && ! $viewer->is($user),
                'grantSuperAdmin' => $viewer->isSuperAdmin(),
            ],
        ]);
    }

    public function suspend(SuspensionRequest $request, User $user, SuspendUser $suspend): RedirectResponse
    {
        $suspend->handle($user, (string) $request->validated('reason'), $request->user());

        return back()->with('success', "Suspendiste la cuenta de {$user->name}.");
    }

    public function reactivate(Request $request, User $user, ReactivateUser $reactivate): RedirectResponse
    {
        $reactivate->handle($user, $request->user());

        return back()->with('success', "La cuenta de {$user->name} está activa otra vez.");
    }

    public function role(ChangeUserRoleRequest $request, User $user, ChangePlatformRole $change): RedirectResponse
    {
        $change->handle($user, $request->role(), $request->user());

        return back()->with('success', "{$user->name} ahora es {$request->role()->label()}.");
    }

    public function access(UpdateStaffCredentialsRequest $request, User $user, SetStaffCredentials $set): RedirectResponse
    {
        $set->handle($user, $request->username(), $request->password(), $request->user());

        return back()->with('success', "{$user->name} ya puede entrar al panel como «{$user->username}».");
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function roleOptions(): array
    {
        return array_map(fn (PlatformRole $role) => ['value' => $role->value, 'label' => $role->label()], PlatformRole::cases());
    }
}
