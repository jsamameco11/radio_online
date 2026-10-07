<?php

namespace App\Domain\Audit;

use App\Models\AuditLog;
use App\Models\Station;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Records important actions (sign-ins, money, permissions, station changes)
 * in the append-only audit log the control panel shows.
 *
 * Actions are dotted verbs: "station.updated", "wallet.deposited",
 * "frequency.assigned", "gift.sent", "user.suspended"…
 */
final class AuditTrail
{
    public function __construct(private readonly Request $request) {}

    /**
     * @param  array<string, mixed>  $meta
     */
    public function record(string $action, ?Model $subject = null, array $meta = [], ?User $actor = null, ?Station $station = null): AuditLog
    {
        $actor ??= $this->request->user();

        return AuditLog::query()->create([
            'actor_id' => $actor?->getKey(),
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey() === null ? null : (string) $subject->getKey(),
            'station_id' => $station?->getKey() ?? ($subject instanceof Station ? $subject->getKey() : $subject?->getAttribute('station_id')),
            'ip_address' => $this->request->ip(),
            'user_agent' => mb_substr((string) $this->request->userAgent(), 0, 255) ?: null,
            'meta' => $meta ?: null,
            'created_at' => now(),
        ]);
    }
}
