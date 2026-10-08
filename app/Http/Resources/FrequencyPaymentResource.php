<?php

namespace App\Http\Resources;

use App\Models\FrequencyListing;
use App\Models\FrequencyPayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The price of a priced frequency and how its payment is going, for the
 * applicant and the staff. Never the processor's card or customer ids.
 *
 * @mixin FrequencyPayment
 */
class FrequencyPaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'amount_cents' => $this->amount_cents,
            'currency' => $this->currency,
            'amount' => FrequencyListing::money($this->amount_cents, $this->currency),
            'status' => ['value' => $this->status->value, 'label' => $this->status->label()],
            'needs_attention' => $this->status->needsAttention(),
            'card' => $this->cardLabel(),
            'card_saved_at' => $this->card_saved_at?->toIso8601String(),
            'charged_at' => $this->charged_at?->toIso8601String(),
            'failure_reason' => $this->failure_reason,
            'failed_at' => $this->failed_at?->toIso8601String(),
            'attempts' => $this->attempts,
        ];
    }
}
