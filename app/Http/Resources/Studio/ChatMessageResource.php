<?php

namespace App\Http\Resources\Studio;

use App\Domain\Chat\Support\HighlightTiers;
use App\Http\Resources\ChatMessageResource as PublicChatMessageResource;
use App\Models\ChatMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A chat message as the station team sees it: what the highlight credited
 * to the station (never what the listener paid or the fees), its
 * visibility, and who of the team answered or hid it.
 * Eager load "user", "sender", "hider" and "replyTo.user".
 *
 * @mixin ChatMessage
 */
class ChatMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'author' => $this->author->value,
            'body' => $this->body,
            'user' => PublicChatMessageResource::author($this->resource),
            'highlight' => $this->isHighlighted() ? [
                'level' => HighlightTiers::levelOf($this->highlight_cents),
                'credited_cents' => $this->station_amount_cents,
                'pinned_until' => $this->pinned_until?->toIso8601String(),
            ] : null,
            'reply_to' => PublicChatMessageResource::replyTo($this->resource),
            'status' => ['value' => $this->status->value, 'label' => $this->status->label()],
            'sent_by' => $this->whenLoaded('sender', fn () => $this->sender?->name),
            'hidden_by' => $this->whenLoaded('hider', fn () => $this->hider?->name),
            'hidden_at' => $this->hidden_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
