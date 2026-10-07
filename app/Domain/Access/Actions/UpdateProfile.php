<?php

namespace App\Domain\Access\Actions;

use App\Domain\Audit\AuditTrail;
use App\Models\User;

/**
 * Updates the public profile of an account. A new email address must be
 * verified again before the account can keep listening.
 */
final class UpdateProfile
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(User $user, string $name, string $email, ?string $country): void
    {
        $emailChanged = strcasecmp($email, $user->email) !== 0;

        $user->forceFill([
            'name' => $name,
            'email' => $email,
            'country' => $country,
            ...($emailChanged ? ['email_verified_at' => null] : []),
        ])->save();

        if ($emailChanged) {
            $user->sendEmailVerificationNotification();
            $this->audit->record('user.email_changed', $user, [], $user);
        }
    }
}
