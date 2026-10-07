<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\Enums\UserStatus;
use App\Domain\Audit\AuditTrail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Suspends an account: it is signed out on its next request and cannot sign
 * in again. Nobody suspends themselves, and only a super administrator may
 * suspend another one.
 */
final class SuspendUser
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(User $target, string $reason, User $actor): User
    {
        if ($target->is($actor)) {
            throw ValidationException::withMessages(['reason' => 'No puedes suspender tu propia cuenta.']);
        }

        if ($target->isSuperAdmin() && ! $actor->isSuperAdmin()) {
            throw ValidationException::withMessages(['reason' => 'Solo un superadministrador puede suspender a otro.']);
        }

        if ($target->isSuspended()) {
            throw ValidationException::withMessages(['reason' => 'La cuenta ya está suspendida.']);
        }

        $target->forceFill([
            'status' => UserStatus::Suspended,
            'suspended_at' => now(),
            'suspension_reason' => $reason,
        ])->save();

        if (config('session.driver') === 'database') {
            DB::table((string) config('session.table', 'sessions'))->where('user_id', $target->id)->delete();
        }

        $this->audit->record('user.suspended', $target, ['reason' => $reason], $actor);

        return $target;
    }
}
