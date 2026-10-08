<?php

namespace App\Domain\Integrity\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Integrity\Enums\AlertStatus;
use App\Models\IntegrityAlert;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Closes an integrity alert. Purging it marks the accounts behind a subscription alert as a
 * bot farm (FlagAccounts), or takes the players of an audience alert out of the statistics;
 * dismissing it leaves everything as it is (the pattern was legitimate).
 */
final class ResolveIntegrityAlert
{
    public function __construct(
        private readonly FlagAccounts $flag,
        private readonly AuditTrail $audit,
    ) {}

    /** @return int accounts marked or players discarded */
    public function handle(IntegrityAlert $alert, AlertStatus $outcome, ?string $note, User $actor): int
    {
        if ($outcome === AlertStatus::Open) {
            throw ValidationException::withMessages(['outcome' => 'Elige depurar o descartar la alerta.']);
        }
        if (! $alert->isOpen()) {
            throw ValidationException::withMessages(['alert' => 'Esta alerta ya fue cerrada.']);
        }
        if ($outcome === AlertStatus::Purged && ! $alert->kind->purgeable()) {
            throw ValidationException::withMessages(['alert' => 'Estos reproductores ya no suman audiencia: marca la alerta como revisada.']);
        }

        $affected = 0;
        if ($outcome === AlertStatus::Purged) {
            $affected = $alert->kind->concernsAccounts()
                ? $this->flag->handle($alert->userIds(), "Alerta de integridad #{$alert->id}: {$alert->kind->label()}", $actor, $alert)
                : $this->discardPlayers($alert);
        }

        $alert->forceFill([
            'status' => $outcome,
            'resolved_by' => $actor->id,
            'resolved_at' => now(),
            'note' => $note,
        ])->save();

        $this->audit->record($outcome === AlertStatus::Purged ? 'integrity.alert_purged' : 'integrity.alert_dismissed', $alert, [
            'kind' => $alert->kind->value,
            'affected' => $affected,
            'note' => $note,
        ], $actor);

        return $affected;
    }

    private function discardPlayers(IntegrityAlert $alert): int
    {
        $since = CarbonImmutable::parse((string) ($alert->evidence['since'] ?? $alert->detected_at));

        return DB::table('listener_sessions')
            ->where('station_id', $alert->station_id)
            ->whereIn('network', $alert->networks())
            ->where('started_at', '>=', $since)
            ->where('suspect', false)
            ->update(['suspect' => true]);
    }
}
