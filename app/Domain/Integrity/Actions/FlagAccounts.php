<?php

namespace App\Domain\Integrity\Actions;

use App\Domain\Access\Support\AccountCache;
use App\Domain\Audit\AuditTrail;
use App\Domain\Integrity\Enums\FollowStatus;
use App\Domain\Integrity\Subscribers;
use App\Models\IntegrityAlert;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Marks accounts as part of a bot farm: every subscription of theirs is discarded (and leaves
 * the subscribers of its station), all their listening turns suspect, and nothing they do
 * counts again until the staff lifts the mark. They can still sign in and listen. Staff
 * accounts are never marked.
 */
final class FlagAccounts
{
    public function __construct(
        private readonly Subscribers $subscribers,
        private readonly AccountCache $accounts,
        private readonly AuditTrail $audit,
    ) {}

    /**
     * @param  list<int>  $userIds
     * @return int accounts marked
     */
    public function handle(array $userIds, string $reason, User $actor, ?IntegrityAlert $alert = null): int
    {
        $ids = User::query()->whereIn('id', $userIds)->whereNull('flagged_at')->whereKeyNot($actor->id)->with('roles')->get()
            ->reject(fn (User $user) => $user->isStaff())
            ->modelKeys();
        if ($ids === []) {
            return 0;
        }

        $stations = DB::transaction(function () use ($ids, $reason) {
            User::query()->whereIn('id', $ids)->update(['flagged_at' => now(), 'flag_reason' => mb_substr($reason, 0, 200)]);
            $follows = DB::table('follows')->whereIn('user_id', $ids)->where('status', '!=', FollowStatus::Discarded->value);
            $stations = (clone $follows)->distinct()->pluck('station_id')->map(fn (mixed $id) => (int) $id)->all();
            $follows->update(['status' => FollowStatus::Discarded->value, 'counted_at' => null]);
            DB::table('listener_sessions')->whereIn('user_id', $ids)->where('suspect', false)->update(['suspect' => true]);
            $this->subscribers->recount($stations);

            return $stations;
        });
        foreach ($ids as $id) {
            $this->accounts->forget($id);
        }

        $this->audit->record('integrity.accounts_flagged', $alert, [
            'accounts' => count($ids),
            'stations' => count($stations),
            'reason' => $reason,
        ], $actor);

        return count($ids);
    }
}
