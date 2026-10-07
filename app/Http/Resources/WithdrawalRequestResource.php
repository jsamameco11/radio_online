<?php

namespace App\Http\Resources;

use App\Domain\Access\Enums\Permission;
use App\Models\WithdrawalRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A withdrawal. The destination is always masked; the full payout details
 * only reach staff allowed to pay withdrawals. The admin list also loads
 * "station.frequency", "requester" and "reviewer".
 *
 * @mixin WithdrawalRequest
 */
class WithdrawalRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'amount_cents' => $this->amount_cents,
            'currency' => $this->currency,
            'status' => ['value' => $this->status->value, 'label' => $this->status->label()],
            'payout_method' => ['value' => $this->payout_method->value, 'label' => $this->payout_method->label()],
            'destination' => $this->maskedDestination(),
            'payout_details' => $this->when($request->user()?->can(Permission::ManagePayouts->value) === true, fn () => [
                'holder' => (string) ($this->payout_details['holder'] ?? ''),
                'account' => (string) ($this->payout_details['account'] ?? ''),
                'bank' => $this->payout_details['bank'] ?? null,
            ]),
            'paid_reference' => $this->paid_reference,
            'review_note' => $this->review_note,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
            'station' => $this->whenLoaded('station', fn () => [
                'id' => $this->station->id,
                'display_name' => $this->station->displayName(),
                'slug' => $this->station->frequency->slug,
                'monetized' => $this->station->isMonetized(),
            ]),
            'requester' => $this->whenLoaded('requester', fn () => $this->requester === null ? null : ['name' => $this->requester->name, 'email' => $this->requester->email]),
            'reviewer' => $this->whenLoaded('reviewer', fn () => $this->reviewer?->name),
        ];
    }
}
