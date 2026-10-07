<?php

namespace App\Domain\Gifts\Actions;

use App\Domain\Audit\AuditTrail;
use App\Models\Gift;
use App\Models\GiftTransaction;
use App\Models\User;

/**
 * Deletes a gift that was never sent. A gift with history can only be
 * deactivated, so past transactions keep pointing at it.
 */
final class RemoveGift
{
    public function __construct(private readonly AuditTrail $audit) {}

    /** Whether the gift was deleted; false when it has history. */
    public function handle(Gift $gift, User $actor): bool
    {
        if (GiftTransaction::query()->where('gift_id', $gift->id)->exists()) {
            return false;
        }

        $this->audit->record('gift.deleted', $gift, ['name' => $gift->name, 'price_cents' => $gift->price_cents], $actor);
        $gift->delete();

        return true;
    }
}
