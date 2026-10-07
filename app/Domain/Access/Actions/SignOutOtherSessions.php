<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\AccountSessions;
use App\Domain\Audit\AuditTrail;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

/**
 * Closes every session of the account except the current one: other
 * browsers lose their "remember me" cookie and their stored sessions.
 */
final class SignOutOtherSessions
{
    public function __construct(
        private readonly AccountSessions $sessions,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(User $user, string $password, string $currentSessionId): void
    {
        Auth::guard('web')->logoutOtherDevices($password);

        $this->sessions->end($user, $currentSessionId);

        $this->audit->record('user.sessions_closed', $user, [], $user);
    }
}
