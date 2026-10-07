<?php

namespace App\Domain\Gifts\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Gifts\Enums\GiftMessageStatus;
use App\Domain\Moderation\Enums\ReportReason;
use App\Domain\Moderation\Enums\ReportStatus;
use App\Models\GiftMessage;
use App\Models\Report;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * The station team flags an abusive message: it leaves the inbox and the
 * platform moderators receive a report about it.
 */
final class ReportGiftMessage
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(GiftMessage $message, User $reporter, Station $station, ReportReason $reason, ?string $details = null): Report
    {
        return DB::transaction(function () use ($message, $reporter, $station, $reason, $details) {
            $message->forceFill(['status' => GiftMessageStatus::Reported])->save();

            $report = Report::query()->firstOrCreate(
                [
                    'reporter_id' => $reporter->id,
                    'reportable_type' => $message->getMorphClass(),
                    'reportable_id' => $message->id,
                    'status' => ReportStatus::Open,
                ],
                ['reason' => $reason, 'details' => $details],
            );

            $this->audit->record('gift_message.reported', $message, ['reason' => $reason->value, 'report_id' => $report->id], $reporter, $station);

            return $report;
        });
    }
}
