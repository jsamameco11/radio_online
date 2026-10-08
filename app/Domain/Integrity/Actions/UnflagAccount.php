<?php

namespace App\Domain\Integrity\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Integrity\Enums\FollowStatus;
use App\Domain\Integrity\Subscribers;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Lifts the bot-farm mark of an account (a false positive): its discarded subscriptions go
 * back to "en verificación" and count again as soon as the account qualifies. Its past
 * listening stays out of the figures.
 */
final class UnflagAccount
{
    public function __construct(
        private readonly Subscribers $subscribers,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(User $user, User $actor): void
    {
        if (! $user->isFlagged()) {
            return;
        }

        DB::transaction(function () use ($user) {
            $user->forceFill(['flagged_at' => null, 'flag_reason' => null])->save();
            DB::table('follows')->where('user_id', $user->id)->where('status', FollowStatus::Discarded->value)
                ->update(['status' => FollowStatus::Pending->value]);
        });
        $this->subscribers->promote();

        $this->audit->record('integrity.account_unflagged', $user, [], $actor);
    }
}
