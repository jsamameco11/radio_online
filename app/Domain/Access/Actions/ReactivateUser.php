<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\Enums\UserStatus;
use App\Domain\Audit\AuditTrail;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/** Lifts the suspension of an account. */
final class ReactivateUser
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(User $target, User $actor): User
    {
        if (! $target->isSuspended()) {
            throw ValidationException::withMessages(['user' => 'La cuenta no está suspendida.']);
        }

        if ($target->isSuperAdmin() && ! $actor->isSuperAdmin()) {
            throw ValidationException::withMessages(['user' => 'Solo un superadministrador puede reactivar a otro.']);
        }

        $target->forceFill(['status' => UserStatus::Active, 'suspended_at' => null, 'suspension_reason' => null])->save();
        $this->audit->record('user.reactivated', $target, [], $actor);

        return $target;
    }
}
