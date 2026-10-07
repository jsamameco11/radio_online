<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Chat\Enums\ChatMessageStatus;
use App\Domain\Chat\Events\ChatMessageVisibilityChanged;
use App\Models\ChatMessage;
use App\Models\Station;
use App\Models\User;

/**
 * Hides a chat message from the listeners or shows it again. A hidden
 * highlight keeps its payment: hiding moderates content, it never refunds.
 * Without an actor the station rules hid it (too many reports).
 */
final class ChangeChatMessageVisibility
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(ChatMessage $message, bool $visible, ?User $actor, Station $station, ?string $reason = null): ChatMessage
    {
        $status = $visible ? ChatMessageStatus::Visible : ChatMessageStatus::Hidden;
        if ($message->status === $status) {
            return $message;
        }

        $message->forceFill([
            'status' => $status,
            'hidden_by' => $visible ? null : $actor?->id,
            'hidden_at' => $visible ? null : now(),
        ])->save();

        $message->load(['user', 'sender', 'hider', 'replyTo.user']);
        event(new ChatMessageVisibilityChanged($message));

        $this->audit->record($visible ? 'chat.restored' : 'chat.hidden', $message, array_filter(['reason' => $reason]), $actor, $station);

        return $message;
    }
}
