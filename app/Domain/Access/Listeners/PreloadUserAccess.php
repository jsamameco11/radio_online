<?php

namespace App\Domain\Access\Listeners;

use App\Domain\Access\Support\AccountCache;
use App\Models\User;
use Illuminate\Auth\Events\Authenticated;

/** The signed-in account always carries its roles, permissions and memberships loaded. */
final class PreloadUserAccess
{
    public function __construct(private readonly AccountCache $accounts) {}

    public function handle(Authenticated $event): void
    {
        if ($event->user instanceof User) {
            $this->accounts->preload($event->user);
        }
    }
}
