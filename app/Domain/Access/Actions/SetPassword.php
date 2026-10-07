<?php

namespace App\Domain\Access\Actions;

use App\Domain\Audit\AuditTrail;
use App\Models\User;

/** Gives an account created with Google a password; it does not sign in with it, it confirms sensitive actions. */
final class SetPassword
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(User $user, string $password): void
    {
        $user->forceFill(['password' => $password])->save();

        $this->audit->record('user.password_set', $user, [], $user);
    }
}
