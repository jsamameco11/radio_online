<?php

namespace App\Domain\Access\Actions;

use App\Domain\Access\Support\AccountCache;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * The control panel sign-in: a staff account found by its username whose password matches.
 * Listeners and creators have no username; they sign in with Google.
 */
final class AuthenticateStaff
{
    public function __construct(private readonly AccountCache $accounts) {}

    public function handle(string $username, string $password): ?User
    {
        $user = User::query()->where('username', Str::lower(trim($username)))->first();

        if ($user === null || $user->getAuthPassword() === null || ! Hash::check($password, $user->getAuthPassword())) {
            return null;
        }

        $this->accounts->preload($user);

        return $user->isStaff() ? $user : null;
    }
}
