<?php

namespace App\Http\Resources\Stations;

use App\Domain\Storage\MediaStorage;
use App\Models\StationMember;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A member of a station team. Eager load "user".
 *
 * @mixin StationMember
 */
class StationMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'role' => $this->role->value,
            'role_label' => $this->role->label(),
            'joined_at' => $this->created_at?->toIso8601String(),
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'avatar_url' => app(MediaStorage::class)->url($this->user->avatar_path),
                'two_factor_enabled' => $this->user->hasTwoFactorEnabled(),
                'last_login_at' => $this->user->last_login_at?->toIso8601String(),
                'suspended' => $this->user->isSuspended(),
            ],
        ];
    }
}
