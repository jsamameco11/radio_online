<?php

namespace App\Models;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Access\Enums\UserStatus;
use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Enums\StationRole;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'password', 'google_id', 'avatar_path', 'country'])]
#[Hidden(['password', 'google_id', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasRoles, Notifiable, TwoFactorAuthenticatable;

    protected $attributes = [
        'status' => 'active',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'status' => UserStatus::class,
            'suspended_at' => 'datetime',
            'last_login_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(StationMember::class);
    }

    public function stations(): BelongsToMany
    {
        return $this->belongsToMany(Station::class, 'station_members')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function ownedStations(): HasMany
    {
        return $this->hasMany(Station::class, 'owner_id');
    }

    public function follows(): BelongsToMany
    {
        return $this->belongsToMany(Station::class, 'follows')
            ->withPivot('created_at');
    }

    public function frequencyRequests(): HasMany
    {
        return $this->hasMany(FrequencyRequest::class);
    }

    public function listenerSessions(): HasMany
    {
        return $this->hasMany(ListenerSession::class);
    }

    public function wallet(): MorphOne
    {
        return $this->morphOne(Wallet::class, 'owner');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function isSuspended(): bool
    {
        return $this->status === UserStatus::Suspended;
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole(PlatformRole::SuperAdmin->value);
    }

    /** Super admins, admins and moderators: they sign in to the control panel with 2FA. */
    public function isStaff(): bool
    {
        return $this->hasAnyRole(array_map(
            fn (PlatformRole $role) => $role->value,
            array_filter(PlatformRole::cases(), fn (PlatformRole $role) => $role->isStaff()),
        ));
    }

    public function hasTwoFactorEnabled(): bool
    {
        return $this->two_factor_secret !== null && $this->two_factor_confirmed_at !== null;
    }

    public function roleIn(Station $station): ?StationRole
    {
        $membership = $this->relationLoaded('memberships')
            ? $this->memberships->firstWhere('station_id', $station->id)
            : $this->memberships()->where('station_id', $station->id)->first();

        return $membership?->role;
    }

    public function canInStation(Station $station, StationPermission $permission): bool
    {
        return (bool) $this->roleIn($station)?->allows($permission);
    }
}
