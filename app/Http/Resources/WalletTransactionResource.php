<?php

namespace App\Http\Resources;

use App\Models\Station;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One line of a wallet history. The platform ledger also loads "wallet.owner"
 * (stations with "frequency") and "actor" to show whose wallet moved and who
 * made a manual adjustment.
 *
 * @mixin WalletTransaction
 */
class WalletTransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => ['value' => $this->type->value, 'label' => $this->type->label()],
            'amount_cents' => $this->amount_cents,
            'balance_before_cents' => $this->balance_before_cents,
            'balance_after_cents' => $this->balance_after_cents,
            'currency' => $this->currency,
            'description' => $this->description,
            'created_at' => $this->created_at->toIso8601String(),
            'owner' => $this->whenLoaded('wallet', fn () => $this->wallet->relationLoaded('owner') ? $this->ownerSummary() : null),
            'actor' => $this->whenLoaded('actor', fn () => $this->actor?->name),
            'idempotency_key' => $this->when($request->user()?->isStaff() === true, $this->idempotency_key),
        ];
    }

    /**
     * @return array{type: string, id: int, name: string}|null
     */
    private function ownerSummary(): ?array
    {
        $owner = $this->wallet->owner;

        return match (true) {
            $owner instanceof User => ['type' => 'user', 'id' => $owner->id, 'name' => $owner->name.' · '.$owner->email],
            $owner instanceof Station => ['type' => 'station', 'id' => $owner->id, 'name' => $owner->displayName()],
            default => null,
        };
    }
}
