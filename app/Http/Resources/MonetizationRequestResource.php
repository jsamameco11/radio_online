<?php

namespace App\Http\Resources;

use App\Models\MonetizationRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A monetization request with the figures frozen when it was sent. The admin
 * list also loads "station.frequency", "station.owner", "requester" and "reviewer".
 *
 * @mixin MonetizationRequest
 */
class MonetizationRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => ['value' => $this->status->value, 'label' => $this->status->label()],
            'subscribers' => $this->subscribers,
            'snapshot' => [
                'subscribers' => (int) ($this->snapshot['subscribers'] ?? $this->subscribers),
                'min_subscribers' => (int) ($this->snapshot['min_subscribers'] ?? 0),
                'live_listeners' => (int) ($this->snapshot['live_listeners'] ?? 0),
                'live_days' => (int) ($this->snapshot['live_days'] ?? 0),
                'qualifying_days' => array_values($this->snapshot['qualifying_days'] ?? []),
            ],
            'review_note' => $this->review_note,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
            'station' => $this->whenLoaded('station', fn () => [
                'id' => $this->station->id,
                'display_name' => $this->station->displayName(),
                'slug' => $this->station->frequency->slug,
                'follower_count' => $this->station->follower_count,
                'owner' => $this->station->relationLoaded('owner') && $this->station->owner !== null
                    ? ['name' => $this->station->owner->name, 'email' => $this->station->owner->email]
                    : null,
            ]),
            'requester' => $this->whenLoaded('requester', fn () => $this->requester?->name),
            'reviewer' => $this->whenLoaded('reviewer', fn () => $this->reviewer?->name),
        ];
    }
}
