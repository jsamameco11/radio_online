<?php

namespace App\Domain\Gifts\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Gifts\Enums\GiftMessageStatus;
use App\Models\GiftMessage;
use App\Models\Station;
use App\Models\User;

/** Hides a listener message from the station's inbox, or shows it again. */
final class ChangeMessageVisibility
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(GiftMessage $message, bool $visible, User $actor, Station $station): GiftMessage
    {
        $status = $visible ? GiftMessageStatus::Visible : GiftMessageStatus::Hidden;

        if ($message->status !== $status) {
            $message->forceFill(['status' => $status])->save();
            $this->audit->record($visible ? 'gift_message.restored' : 'gift_message.hidden', $message, [], $actor, $station);
        }

        return $message;
    }
}
