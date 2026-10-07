<?php

namespace App\Domain\Access\Support;

use Illuminate\Auth\EloquentUserProvider;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Hashing\Hasher;

/**
 * The "accounts" user provider (config/auth.php): the account of each signed-in session comes
 * from AccountCache, with its roles and memberships, instead of a query per request.
 */
final class CachedUserProvider extends EloquentUserProvider
{
    public function __construct(Hasher $hasher, string $model, private readonly AccountCache $accounts)
    {
        parent::__construct($hasher, $model);
    }

    public function retrieveById($identifier): ?Authenticatable
    {
        return is_numeric($identifier) ? $this->accounts->find((int) $identifier) : null;
    }
}
