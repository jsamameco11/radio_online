<?php

namespace App\Domain\Access\Actions;

use App\Domain\Audit\AuditTrail;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Closes every session of the account except the current one: other
 * browsers lose their "remember me" cookie and their stored sessions.
 */
final class SignOutOtherSessions
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(User $user, string $password, string $currentSessionId): void
    {
        Auth::guard('web')->logoutOtherDevices($password);

        if (config('session.driver') === 'database') {
            DB::connection(config('session.connection'))
                ->table((string) config('session.table', 'sessions'))
                ->where('user_id', $user->id)
                ->where('id', '!=', $currentSessionId)
                ->delete();
        }

        $this->audit->record('user.sessions_closed', $user, [], $user);
    }
}
