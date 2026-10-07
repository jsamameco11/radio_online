<?php

namespace App\Domain\Gifts\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Gifts\Enums\GiftMessageStatus;
use App\Domain\Gifts\Events\GiftCelebrated;
use App\Domain\Gifts\Events\GiftReceived;
use App\Domain\Gifts\Support\GiftFee;
use App\Domain\Gifts\Support\GiftPreferences;
use App\Domain\Gifts\Support\MessageFilter;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Storage\MediaFolder;
use App\Domain\Storage\MediaStorage;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\Gift;
use App\Models\GiftTransaction;
use App\Models\Station;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * A listener sends a gift to a station, optionally with a text and/or a
 * voice message. The listener's wallet is debited the full price, the
 * station's wallet is credited its share and the platform keeps its fee, all
 * in one database transaction. The idempotency key comes from the client, so
 * a double click or a retried request sends the gift only once.
 */
final class SendGift
{
    public const MAX_QUANTITY = 99;

    public function __construct(
        private readonly WalletLedger $ledger,
        private readonly MediaStorage $storage,
        private readonly GiftPreferences $preferences,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(
        User $sender,
        Station $station,
        Gift $gift,
        int $quantity,
        string $idempotencyKey,
        ?string $message = null,
        ?UploadedFile $voice = null,
        ?float $voiceSeconds = null,
        bool $anonymous = false,
    ): GiftTransaction {
        $key = 'gift:'.$sender->id.':'.$idempotencyKey;

        $existing = $this->find($key);
        if ($existing !== null) {
            return $existing;
        }

        $message = $message === null || trim($message) === '' ? null : trim($message);
        $this->validate($sender, $station, $gift, $quantity, $message, $voice, $voiceSeconds);

        $station->loadMissing('frequency');
        $fee = GiftFee::split($gift->price_cents * $quantity);
        $policy = $this->preferences->messages($station);
        $filtered = $message === null ? null : MessageFilter::apply($message, $policy['blocked_words']);
        $hidden = $filtered !== null && $filtered['flagged'] && $policy['auto_hide_filtered'];

        $from = $this->ledger->open($sender);
        $to = $this->ledger->open($station);
        $voicePath = $voice === null ? null : $this->storage->store($voice, MediaFolder::GiftMessages, $station->id);

        try {
            [$transaction, $created] = DB::transaction(fn () => $this->record(
                $key, $sender, $station, $gift, $quantity, $fee, $from, $to, $anonymous,
                $filtered['text'] ?? null, $hidden, $voicePath, $voice, $voiceSeconds,
            ), 3);
        } catch (Throwable $exception) {
            $this->storage->delete($voicePath);

            throw $exception;
        }

        if (! $created) {
            $this->storage->delete($voicePath);

            return $transaction;
        }

        $transaction->load(['gift', 'sender', 'message', 'station.frequency']);

        event(new GiftReceived($transaction));
        event(new GiftCelebrated($transaction));

        $this->audit->record('gift.sent', $transaction, [
            'gift' => $gift->slug,
            'quantity' => $quantity,
            'total_cents' => $fee->totalCents,
            'processor_fee_cents' => $fee->processorFeeCents,
            'platform_fee_cents' => $fee->platformFeeCents,
            'with_voice' => $voicePath !== null,
        ], $sender, $station);

        return $transaction;
    }

    /**
     * @return array{0: GiftTransaction, 1: bool} The gift and whether this call created it.
     */
    private function record(
        string $key,
        User $sender,
        Station $station,
        Gift $gift,
        int $quantity,
        GiftFee $fee,
        Wallet $from,
        Wallet $to,
        bool $anonymous,
        ?string $body,
        bool $hidden,
        ?string $voicePath,
        ?UploadedFile $voice,
        ?float $voiceSeconds,
    ): array {
        $transaction = new GiftTransaction;
        $transaction->id = $transaction->newUniqueId();

        $label = trim($gift->emoji.' '.$gift->name).($quantity > 1 ? ' ×'.$quantity : '');
        $meta = ['gift_id' => $gift->id, 'quantity' => $quantity, 'station_id' => $station->id];

        [$debit, $credit] = $this->ledger->transfer(
            $from,
            $to,
            $fee->totalCents,
            $fee->deductedCents(),
            new LedgerEntry($key.':debit', 'Regalo para '.$station->displayName().': '.$label, $transaction, $sender, $meta),
            new LedgerEntry($key.':credit', 'Regalo de '.($anonymous ? 'un oyente anónimo' : $sender->name).': '.$label, $transaction, $sender, $meta),
        );

        $concurrent = $this->find($key);
        if ($concurrent !== null) {
            return [$concurrent, false];
        }

        $transaction->fill([
            'gift_id' => $gift->id,
            'sender_id' => $sender->id,
            'station_id' => $station->id,
            'quantity' => $quantity,
            'unit_price_cents' => $gift->price_cents,
            'total_cents' => $fee->totalCents,
            'processor_fee_cents' => $fee->processorFeeCents,
            'platform_fee_cents' => $fee->platformFeeCents,
            'station_amount_cents' => $fee->stationAmountCents,
            'debit_transaction_id' => $debit->id,
            'credit_transaction_id' => $credit->id,
            'anonymous' => $anonymous,
            'idempotency_key' => $key,
        ])->save();

        if ($body !== null || $voicePath !== null) {
            $transaction->message()->create([
                'body' => $body,
                'voice_path' => $voicePath,
                'voice_mime' => $voice === null ? null : $this->audioMime($voice),
                'voice_duration' => $voicePath === null ? null : round((float) $voiceSeconds, 2),
                'status' => $hidden ? GiftMessageStatus::Hidden : GiftMessageStatus::Visible,
            ]);
        }

        return [$transaction, true];
    }

    private function validate(User $sender, Station $station, Gift $gift, int $quantity, ?string $message, ?UploadedFile $voice, ?float $voiceSeconds): void
    {
        $gifts = $this->preferences->gifts($station);
        $messages = $this->preferences->messages($station);
        $limits = config('platform.gifts');
        $errors = [];

        if ($sender->isSuspended()) {
            $errors['gift_id'] = 'Tu cuenta está suspendida y no puede enviar regalos.';
        } elseif ($station->status !== StationStatus::Active || $station->trashed()) {
            $errors['gift_id'] = 'Esta emisora no está recibiendo regalos en este momento.';
        } elseif (! $gifts['enabled']) {
            $errors['gift_id'] = 'Esta emisora no tiene los regalos activados.';
        } elseif (! $gift->active) {
            $errors['gift_id'] = 'Este regalo ya no está disponible.';
        }

        if ($quantity < 1 || $quantity > self::MAX_QUANTITY) {
            $errors['quantity'] = 'Puedes enviar de 1 a '.self::MAX_QUANTITY.' unidades del regalo.';
        } elseif ($gift->price_cents * $quantity < $gifts['min_gift_cents']) {
            $errors['quantity'] = 'El regalo mínimo para esta emisora es de US$ '.number_format($gifts['min_gift_cents'] / 100, 2).'.';
        }

        if ($message !== null && ! $messages['accept_text']) {
            $errors['message'] = 'Esta emisora no recibe mensajes de texto.';
        } elseif ($message !== null && mb_strlen($message) > $limits['max_message_length']) {
            $errors['message'] = 'El mensaje puede tener como máximo '.$limits['max_message_length'].' caracteres.';
        }

        if ($voice !== null && ! $messages['accept_voice']) {
            $errors['voice'] = 'Esta emisora no recibe mensajes de voz.';
        } elseif ($voice !== null && $voice->getSize() > $limits['max_voice_kilobytes'] * 1024) {
            $errors['voice'] = 'El mensaje de voz es demasiado pesado.';
        } elseif ($voice !== null && ($voiceSeconds === null || $voiceSeconds <= 0 || $voiceSeconds > $limits['max_voice_seconds'])) {
            $errors['voice'] = 'El mensaje de voz puede durar como máximo '.$limits['max_voice_seconds'].' segundos.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function find(string $key): ?GiftTransaction
    {
        return GiftTransaction::query()->where('idempotency_key', $key)->first();
    }

    /** Browsers record WebM/MP4 audio that file sniffing reports as video. */
    private function audioMime(UploadedFile $voice): string
    {
        $mime = (string) $voice->getMimeType();

        return str_starts_with($mime, 'video/') ? 'audio/'.substr($mime, 6) : $mime;
    }
}
