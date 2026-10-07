<?php

namespace App\Http\Resources;

use App\Models\GiftMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The text and/or voice note attached to a gift, as the station team sees it.
 * The audio itself is served by the studio route /mensajes/{id}/audio.
 *
 * @mixin GiftMessage
 */
class GiftMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'body' => $this->body,
            'has_voice' => $this->voice_path !== null,
            'voice_duration' => $this->voice_duration,
            'status' => ['value' => $this->status->value, 'label' => $this->status->label()],
            'played_at' => $this->played_at?->toIso8601String(),
            'played_by' => $this->whenLoaded('player', fn () => $this->player?->name),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
