<?php

namespace App\Domain\Moderation\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Moderation\Enums\ReportStatus;
use App\Models\Report;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Closes a report as resolved (action taken) or dismissed (nothing wrong).
 * The decision applies to every open report about the same content.
 */
final class ResolveReport
{
    public function __construct(private readonly AuditTrail $audit) {}

    /**
     * @return int How many reports were closed.
     */
    public function handle(Report $report, ReportStatus $outcome, ?string $note, User $actor): int
    {
        if (! in_array($outcome, [ReportStatus::Resolved, ReportStatus::Dismissed], true)) {
            throw ValidationException::withMessages(['outcome' => 'Elige resolver o descartar el reporte.']);
        }

        if (! in_array($report->status, [ReportStatus::Open, ReportStatus::Reviewing], true)) {
            throw ValidationException::withMessages(['report' => 'Este reporte ya fue cerrado.']);
        }

        $closed = DB::transaction(fn () => Report::query()
            ->where('reportable_type', $report->reportable_type)
            ->where('reportable_id', $report->reportable_id)
            ->whereIn('status', [ReportStatus::Open->value, ReportStatus::Reviewing->value])
            ->update([
                'status' => $outcome->value,
                'resolved_by' => $actor->id,
                'resolved_at' => now(),
                'resolution_note' => $note,
                'updated_at' => now(),
            ]));

        $this->audit->record($outcome === ReportStatus::Resolved ? 'report.resolved' : 'report.dismissed', $report, [
            'target' => $report->reportable_type.':'.$report->reportable_id,
            'closed' => $closed,
            'note' => $note,
        ], $actor);

        return $closed;
    }
}
