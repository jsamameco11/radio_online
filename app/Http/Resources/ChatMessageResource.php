<?php

namespace App\Http\Resources;

use App\Domain\Chat\Enums\ChatAuthor;
use App\Domain\Chat\Support\HighlightTiers;
use App\Domain\Storage\MediaStorage;
use App\Models\ChatMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A chat message as listeners see it: the author's public name and avatar,
 * its sticker, the highlight tier the listener paid for and the message it answers.
 * Never fees, emails or moderation data. Eager load "user" and "replyTo.user".
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
            'sticker' => self::sticker($this->resource),
            'user' => self::author($this->resource),
            'highlight' => $this->isHighlighted() ? [
                'cents' => $this->highlight_cents,
                'level' => HighlightTiers::levelOf($this->highlight_cents),
                'pinned_until' => $this->pinned_until?->toIso8601String(),
            ] : null,
            'reply_to' => self::replyTo($this->resource),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }

    /**
     * @return array{id: int, name: string, avatar_url: string|null}|null
     */
    public static function author(ChatMessage $message): ?array
    {
        if ($message->author !== ChatAuthor::Listener || $message->user === null) {
            return null;
        }

        return [
            'id' => $message->user->id,
            'name' => $message->user->name,
            'avatar_url' => app(MediaStorage::class)->url($message->user->avatar_path),
        ];
    }

    /**
     * @return array{key: string, label: string}|null
     */
    public static function sticker(ChatMessage $message): ?array
    {
        return $message->sticker === null ? null : ['key' => $message->sticker->value, 'label' => $message->sticker->label()];
    }

    /**
     * @return array{id: string, author: string, name: string|null, body: string|null}|null
     */
    public static function replyTo(ChatMessage $message): ?array
    {
        $original = $message->replyTo;
        if ($original === null) {
            return null;
        }

        return [
            'id' => $original->id,
            'author' => $original->author->value,
            'name' => $original->author === ChatAuthor::Listener ? $original->user?->name : null,
            'body' => $original->isVisible() ? mb_strimwidth($original->preview(), 0, 90, '…') : null,
        ];
    }
}
