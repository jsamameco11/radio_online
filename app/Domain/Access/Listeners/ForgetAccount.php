<?php

namespace App\Domain\Access\Listeners;

use App\Domain\Access\Support\AccountCache;
use App\Models\StationMember;
use App\Models\User;
use Spatie\Permission\Events\PermissionAttachedEvent;
use Spatie\Permission\Events\PermissionDetachedEvent;
use Spatie\Permission\Events\RoleAttachedEvent;
use Spatie\Permission\Events\RoleDetachedEvent;

/**
 * Drops the cached account (AccountCache) when its user record, platform roles, direct
 * permissions or station memberships change. Also observes User and StationMember.
 */
final class ForgetAccount
{
    public bool $afterCommit = true;

    public function __construct(private readonly AccountCache $accounts) {}

    public function handle(RoleAttachedEvent|RoleDetachedEvent|PermissionAttachedEvent|PermissionDetachedEvent $event): void
    {
        if ($event->model instanceof User) {
            $this->accounts->forget($event->model->id);
        }
    }

    public function created(User|StationMember $model): void
    {
        $this->forgetOwnerOf($model);
    }

    public function updated(User|StationMember $model): void
    {
        $this->forgetOwnerOf($model);
    }

    public function deleted(User|StationMember $model): void
    {
        $this->forgetOwnerOf($model);
    }

    private function forgetOwnerOf(User|StationMember $model): void
    {
        $this->accounts->forget($model instanceof User ? $model->id : $model->user_id);
    }
}
