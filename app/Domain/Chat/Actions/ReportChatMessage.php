<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Support\ChatModeration;
use App\Domain\Moderation\Actions\ReportContent;
use App\Domain\Moderation\Enums\ReportReason;
use App\Domain\Moderation\Enums\ReportStatus;
use App\Models\ChatMessage;
use App\Models\Report;
use App\Models\Station;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * A listener flags a chat message for the moderation team. When the station
 * hides much-reported content, the message leaves the chat as soon as it
 * gathers the station's threshold of open reports.
 */
final class ReportChatMessage
{
    public function __construct(
        private readonly ReportContent $report,
        private readonly ChangeChatMessageVisibility $visibility,
    ) {}

    public function handle(User $reporter, Station $station, ChatMessage $message, ReportReason $reason, ?string $details): Report
    {
        if ($message->user_id === $reporter->id) {
            throw ValidationException::withMessages(['reason' => 'No puedes reportar tu propio mensaje.']);
        }

        $report = $this->report->handle($reporter, $message, $reason, $details);

        $moderation = ChatModeration::of($station);
        if ($moderation->autoHideReported && $message->isVisible()) {
            $open = Report::query()
                ->where('reportable_type', $message->getMorphClass())
                ->where('reportable_id', $message->id)
                ->where('status', ReportStatus::Open->value)
                ->count();

            if ($open >= $moderation->autoHideThreshold) {
                $this->visibility->handle($message, false, null, $station, 'Reportes de los oyentes');
            }
        }

        return $report;
    }
}
