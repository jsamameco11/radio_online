<?php

namespace App\Http\Resources\Admin;

use App\Domain\Platform\PlatformHost;
use App\Models\FrequencyListing;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A sale as the platform staff handles it: what is sold, who sells and buys,
 * the split of the price and, for a station its owner sells, where to pay
 * the seller.
 *
 * Eager load "frequency", "station.frequency" (with trashed), "seller",
 * "buyer" and "payer".
 *
 * @mixin FrequencyListing
 */
class FrequencySaleRowResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $person = fn (?User $user) => $user === null ? null : ['name' => $user->name, 'email' => $user->email];

        return [
            'id' => $this->id,
            'by_platform' => $this->by_platform,
            'frequency' => $this->frequency->display(),
            'station' => $this->station?->displayName(),
            'public_url' => PlatformHost::Public->url('frecuencias-en-venta/'.$this->id),
            'seller' => $person($this->seller),
            'buyer' => $person($this->buyer),
            'status' => ['value' => $this->status->value, 'label' => $this->status->label()],
            'payout_status' => $this->payout_status === null ? null : ['value' => $this->payout_status->value, 'label' => $this->payout_status->label()],
            'currency' => $this->currency,
            'price_cents' => $this->price_cents,
            'processor_fee_cents' => $this->processor_fee_cents,
            'fee_cents' => $this->fee_cents,
            'tax_cents' => $this->tax_cents,
            'settled_balance_cents' => $this->settled_balance_cents,
            'payout_cents' => $this->payout_cents,
            'payout_method' => $this->payout_method === null ? null : ['value' => $this->payout_method->value, 'label' => $this->payout_method->label()],
            'payout_details' => $this->payout_details,
            'payout_reference' => $this->payout_reference,
            'payout_note' => $this->payout_note,
            'payer' => $this->payer?->name,
            'listed_at' => $this->created_at?->toIso8601String(),
            'sold_at' => $this->sold_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
        ];
    }
}
