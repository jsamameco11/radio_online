<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\ChatRoom;
use App\Domain\Chat\Enums\ChatAuthor;
use App\Domain\Chat\Enums\ChatSticker;
use App\Domain\Chat\Events\ChatMessagePosted;
use App\Domain\Chat\Events\ChatMessageReceived;
use App\Models\ChatMessage;
use App\Models\Station;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;

/**
 * A member of the station team writes in the chat as the station, to
 * everyone or answering one message. Listeners see the station's identity,
 * never the team member; the team keeps who wrote it. A reply can be text,
 * a sticker or both.
 */
final class ReplyAsStation
{
    public function __construct(private readonly ChatRoom $room) {}

    public function handle(User $member, Station $station, string $body, string $clientKey, ?ChatMessage $replyTo = null, ?ChatSticker $sticker = null): ChatMessage
    {
        $key = 'chat:'.$member->id.':'.$clientKey;

        $existing = ChatMessage::acrossStations()->where('idempotency_key', $key)->first();
        if ($existing !== null) {
            return $existing;
        }

        $body = trim($body);
        $max = (int) config('platform.chat.max_message_length');

        $error = match (true) {
            ! $this->room->isOpen($station) => 'El chat se abre cuando la radio está en vivo.',
            $body === '' && $sticker === null => 'Escribe un mensaje o elige un sticker.',
            mb_strlen($body) > $max => "El mensaje puede tener como máximo {$max} caracteres.",
            $replyTo !== null && $replyTo->station_id !== $station->id => 'Ese mensaje no es de este chat.',
            default => null,
        };
        if ($error !== null) {
            throw ValidationException::withMessages(['body' => $error]);
        }

        try {
            $message = ChatMessage::query()->create([
                'station_id' => $station->id,
                'stream_session_id' => $this->room->session($station)?->id,
                'sent_by' => $member->id,
                'author' => ChatAuthor::Station,
                'reply_to_id' => $replyTo?->id,
                'body' => $body,
                'sticker' => $sticker,
                'idempotency_key' => $key,
            ]);
        } catch (UniqueConstraintViolationException) {
            return ChatMessage::acrossStations()->where('idempotency_key', $key)->firstOrFail();
        }

        $message->load(['user', 'sender', 'hider', 'replyTo.user']);

        event(new ChatMessagePosted($message));
        event(new ChatMessageReceived($message));

        return $message;
    }
}
