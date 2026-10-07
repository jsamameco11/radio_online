<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Chat\ChatRoom;
use App\Domain\Chat\Enums\ChatAuthor;
use App\Domain\Chat\Events\ChatMessagePosted;
use App\Domain\Chat\Events\ChatMessageReceived;
use App\Domain\Chat\Support\ChatModeration;
use App\Domain\Chat\Support\HighlightTiers;
use App\Domain\Gifts\Support\GiftFee;
use App\Domain\Gifts\Support\MessageFilter;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\ChatMessage;
use App\Models\Station;
use App\Models\StreamSession;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A listener writes in the chat of a station that is live, optionally paying
 * to highlight the message. A highlight moves money exactly like a gift: the
 * listener pays the tier price, the station is credited its share and the
 * processor and platform fees stay out, all in one database transaction.
 *
 * Slow mode spaces out the free messages of each listener; a paid highlight
 * skips it and does not start its countdown. The idempotency key comes from
 * the client, so a retried request posts (and charges) only once.
 */
final class PostChatMessage
{
    public function __construct(
        private readonly WalletLedger $ledger,
        private readonly ChatRoom $room,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(User $author, Station $station, string $body, string $clientKey, ?int $highlightCents = null): ChatMessage
    {
        $key = 'chat:'.$author->id.':'.$clientKey;

        $existing = $this->find($key);
        if ($existing !== null) {
            return $existing;
        }

        $body = trim($body);
        $tier = $highlightCents === null ? null : HighlightTiers::find($highlightCents);
        $moderation = ChatModeration::of($station);
        $this->validate($author, $station, $body, $highlightCents, $tier, $moderation);

        $station->loadMissing('frequency');
        $text = MessageFilter::apply($body, $moderation->blockedWords)['text'];
        $session = $this->room->session($station);

        if ($tier === null) {
            $this->enterSlowMode($author, $station, $moderation);
            [$message, $created] = $this->post($key, $author, $station, $session, $text);
        } else {
            $from = $this->ledger->open($author);
            $to = $this->ledger->open($station);
            [$message, $created] = DB::transaction(fn () => $this->postHighlighted($key, $author, $station, $session, $text, $tier, $from, $to), 3);
        }

        if (! $created) {
            return $message;
        }

        $message->load(['user', 'sender', 'hider', 'replyTo.user']);

        event(new ChatMessagePosted($message));
        event(new ChatMessageReceived($message));

        if ($message->isHighlighted()) {
            $this->audit->record('chat.highlighted', $message, [
                'highlight_cents' => $message->highlight_cents,
                'processor_fee_cents' => $message->processor_fee_cents,
                'platform_fee_cents' => $message->platform_fee_cents,
                'station_amount_cents' => $message->station_amount_cents,
            ], $author, $station);
        }

        return $message;
    }

    /**
     * @return array{0: ChatMessage, 1: bool} The message and whether this call created it.
     */
    private function post(string $key, User $author, Station $station, ?StreamSession $session, string $text): array
    {
        try {
            return [ChatMessage::query()->create($this->attributes($key, $author, $station, $session, $text)), true];
        } catch (UniqueConstraintViolationException) {
            return [$this->find($key) ?? throw ValidationException::withMessages(['body' => 'No pudimos enviar tu mensaje. Inténtalo de nuevo.']), false];
        }
    }

    /**
     * @param  array{cents: int, pin_seconds: int, level: int}  $tier
     * @return array{0: ChatMessage, 1: bool} The message and whether this call created it.
     */
    private function postHighlighted(string $key, User $author, Station $station, ?StreamSession $session, string $text, array $tier, Wallet $from, Wallet $to): array
    {
        $message = new ChatMessage;
        $message->id = $message->newUniqueId();

        $fee = GiftFee::split($tier['cents']);
        $meta = ['station_id' => $station->id, 'highlight_cents' => $tier['cents']];

        [$debit, $credit] = $this->ledger->transfer(
            $from,
            $to,
            $fee->totalCents,
            $fee->deductedCents(),
            new LedgerEntry($key.':debit', 'Mensaje destacado para '.$station->displayName(), $message, $author, $meta),
            new LedgerEntry($key.':credit', 'Mensaje destacado de '.$author->name, $message, $author, $meta),
            WalletTransactionType::HighlightPurchase,
            WalletTransactionType::HighlightEarning,
        );

        $concurrent = $this->find($key);
        if ($concurrent !== null) {
            return [$concurrent, false];
        }

        $message->fill([
            ...$this->attributes($key, $author, $station, $session, $text),
            'highlight_cents' => $fee->totalCents,
            'processor_fee_cents' => $fee->processorFeeCents,
            'platform_fee_cents' => $fee->platformFeeCents,
            'station_amount_cents' => $fee->stationAmountCents,
            'pinned_until' => $tier['pin_seconds'] > 0 ? now()->addSeconds($tier['pin_seconds']) : null,
            'debit_transaction_id' => $debit->id,
            'credit_transaction_id' => $credit->id,
        ])->save();

        return [$message, true];
    }

    /**
     * @return array<string, mixed>
     */
    private function attributes(string $key, User $author, Station $station, ?StreamSession $session, string $text): array
    {
        return [
            'station_id' => $station->id,
            'stream_session_id' => $session?->id,
            'user_id' => $author->id,
            'author' => ChatAuthor::Listener,
            'body' => $text,
            'idempotency_key' => $key,
        ];
    }

    /**
     * @param  array{cents: int, pin_seconds: int, level: int}|null  $tier
     */
    private function validate(User $author, Station $station, string $body, ?int $highlightCents, ?array $tier, ChatModeration $moderation): void
    {
        $max = (int) config('platform.chat.max_message_length');
        $errors = [];

        if ($author->isSuspended()) {
            $errors['body'] = 'Tu cuenta está suspendida y no puede escribir en el chat.';
        } elseif (! $this->room->isOpen($station)) {
            $errors['body'] = 'El chat se abre cuando la radio está en vivo.';
        } elseif (($mute = $this->room->mute($station, $author)) !== null) {
            $errors['body'] = $mute->until === null
                ? 'La emisora pausó tus mensajes en este chat. Puedes seguir leyendo la conversación.'
                : 'La emisora pausó tus mensajes en este chat hasta las '.$mute->until->timezone((string) config('platform.timezone'))->format('H:i').'. Puedes seguir leyendo la conversación.';
        } elseif ($body === '') {
            $errors['body'] = 'Escribe un mensaje.';
        } elseif (mb_strlen($body) > $max) {
            $errors['body'] = "El mensaje puede tener como máximo {$max} caracteres.";
        } elseif ($moderation->blockLinks && ChatModeration::containsLink($body)) {
            $errors['body'] = 'Esta emisora no permite enlaces en el chat.';
        }

        if ($highlightCents !== null && $tier === null) {
            $errors['highlight_cents'] = 'Elige uno de los montos de destacado disponibles.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /** Takes the listener's turn in slow mode, or refuses with the seconds left. */
    private function enterSlowMode(User $author, Station $station, ChatModeration $moderation): void
    {
        $seconds = $moderation->slowModeSeconds;
        if ($seconds === 0) {
            return;
        }

        $key = "station:{$station->id}:chat.slow:{$author->id}";
        if (Cache::add($key, now()->addSeconds($seconds)->getTimestamp(), $seconds)) {
            return;
        }

        $left = max(1, (int) Cache::get($key, 0) - now()->getTimestamp());

        throw ValidationException::withMessages([
            'body' => "El chat está en modo lento: espera {$left} ".($left === 1 ? 'segundo' : 'segundos').' para volver a escribir, o destaca tu mensaje.',
        ]);
    }

    private function find(string $key): ?ChatMessage
    {
        return ChatMessage::acrossStations()->where('idempotency_key', $key)->first();
    }
}
