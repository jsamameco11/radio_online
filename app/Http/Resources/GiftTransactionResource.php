<?php

namespace App\Http\Resources;

use App\Domain\Storage\MediaStorage;
use App\Models\GiftTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A gift a station received. Anonymous senders stay anonymous for the
 * station team too. Load "gift", "sender" and "message" (with "message.player"
 * to know who played it).
 *
 * @mixin GiftTransaction
 */
class GiftTransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'quantity' => $this->quantity,
            'unit_price_cents' => $this->unit_price_cents,
            'total_cents' => $this->total_cents,
            'platform_fee_cents' => $this->platform_fee_cents,
            'station_amount_cents' => $this->station_amount_cents,
            'anonymous' => $this->anonymous,
            'gift' => $this->whenLoaded('gift', fn () => [
                'id' => $this->gift->id,
                'name' => $this->gift->name,
                'emoji' => $this->gift->emoji,
                'animation' => $this->gift->animation,
            ]),
            'sender' => $this->whenLoaded('sender', fn () => $this->anonymous ? null : [
                'id' => $this->sender->id,
                'name' => $this->sender->name,
                'avatar_url' => app(MediaStorage::class)->url($this->sender->avatar_path),
            ]),
            'message' => $this->whenLoaded('message', fn () => $this->message === null ? null : GiftMessageResource::make($this->message)->resolve($request)),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
