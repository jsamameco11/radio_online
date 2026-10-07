<?php

namespace App\Domain\Moderation\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Moderation\Enums\ReportReason;
use App\Domain\Moderation\Enums\ReportStatus;
use App\Models\Report;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * A user flags a station or an episode for the moderation team. While a
 * report of the same user about the same content is still open it is
 * updated instead of duplicated.
 */
final class ReportContent
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(User $reporter, Model $subject, ReportReason $reason, ?string $details): Report
    {
        $report = Report::query()->updateOrCreate(
            [
                'reporter_id' => $reporter->id,
                'reportable_type' => $subject->getMorphClass(),
                'reportable_id' => (string) $subject->getKey(),
                'status' => ReportStatus::Open,
            ],
            [
                'reason' => $reason,
                'details' => $details,
            ],
        );

        $this->audit->record('report.submitted', $subject, ['reason' => $reason->value, 'report_id' => $report->id], $reporter);

        return $report;
    }
}
