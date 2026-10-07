<?php

namespace App\Domain\Gifts\Actions;

use App\Domain\Gifts\Events\GiftMessagePlayed;
use App\Models\GiftMessage;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Records the first time the station team played a voice or text message,
 * and tells every open console. Playing it again changes nothing.
 */
final class MarkMessagePlayed
{
    public function handle(GiftMessage $message, User $host, int $stationId): GiftMessage
    {
        $updated = DB::table('gift_messages')
            ->where('id', $message->id)
            ->whereNull('played_at')
            ->update(['played_at' => now(), 'played_by' => $host->id, 'updated_at' => now()]);

        $message->refresh();

        if ($updated === 1) {
            event(GiftMessagePlayed::from($message, $stationId, $host->name));
        }

        return $message;
    }
}
