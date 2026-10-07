<?php

namespace App\Http\Resources;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A wallet top-up. The admin panel loads "user" to show who paid.
 *
 * @mixin Payment
 */
class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'provider' => $this->provider,
            'amount_cents' => $this->amount_cents,
            'currency' => $this->currency,
            'status' => ['value' => $this->status->value, 'label' => $this->status->label()],
            'failure_reason' => $this->failure_reason,
            'paid_at' => $this->paid_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
            'user' => $this->whenLoaded('user', fn () => ['id' => $this->user->id, 'name' => $this->user->name, 'email' => $this->user->email]),
            'provider_reference' => $this->when($request->user()?->isStaff() === true, $this->provider_reference),
        ];
    }
}
