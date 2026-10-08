<?php

namespace App\Http\Resources\Admin;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Storage\MediaStorage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An account in the control panel. Eager load "roles"; "memberships_count"
 * is used when loaded.
 *
 * @mixin User
 */
class UserRowResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $role = PlatformRole::tryFrom((string) $this->roles->first()?->name) ?? PlatformRole::Listener;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->username,
            'email' => $this->email,
            'avatar_url' => app(MediaStorage::class)->url($this->avatar_path),
            'country' => $this->country,
            'role' => $role->value,
            'role_label' => $role->label(),
            'is_staff' => $role->isStaff(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'suspended_at' => $this->suspended_at?->toIso8601String(),
            'suspension_reason' => $this->suspension_reason,
            'flagged_at' => $this->flagged_at?->toIso8601String(),
            'flag_reason' => $this->flag_reason,
            'email_verified' => $this->email_verified_at !== null,
            'two_factor_enabled' => $this->hasTwoFactorEnabled(),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'last_login_ip' => $this->last_login_ip,
            'memberships_count' => $this->whenCounted('memberships'),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
