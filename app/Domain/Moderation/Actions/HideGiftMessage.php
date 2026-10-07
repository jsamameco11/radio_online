<?php

namespace App\Domain\Moderation\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Gifts\Enums\GiftMessageStatus;
use App\Models\GiftMessage;
use App\Models\User;

/** Hides the text and voice note of a gift from the station and its listeners. */
final class HideGiftMessage
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(GiftMessage $message, ?string $reason, User $actor): GiftMessage
    {
        if ($message->status === GiftMessageStatus::Hidden) {
            return $message;
        }

        $message->update(['status' => GiftMessageStatus::Hidden]);
        $message->loadMissing('giftTransaction.station');

        $this->audit->record('gift_message.hidden', $message, array_filter(['reason' => $reason]), $actor, $message->giftTransaction->station);

        return $message;
    }
}
