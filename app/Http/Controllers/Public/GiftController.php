<?php

namespace App\Http\Controllers\Public;

use App\Domain\Gifts\Actions\SendGift;
use App\Domain\Gifts\Support\GiftPreferences;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Wallet\WalletLedger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Gifts\SendGiftRequest;
use App\Http\Resources\GiftResource;
use App\Models\Frequency;
use App\Models\Gift;
use App\Models\Station;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The gift modal of a station page: its catalog and the send endpoint. */
class GiftController extends Controller
{
    /** GET /radio/{frequency}/regalos: what this station accepts and what the listener can afford. */
    public function catalog(Request $request, Frequency $frequency, WalletLedger $ledger, GiftPreferences $preferences): JsonResponse
    {
        $station = $this->station($frequency);
        $gifts = $preferences->gifts($station);
        $messages = $preferences->messages($station);

        return response()->json([
            'gifts' => GiftResource::collection(Gift::query()->available()->get())->resolve($request),
            'balance_cents' => $ledger->balance($request->user()),
            'station' => [
                'accepts_gifts' => $gifts['enabled'] && $station->status === StationStatus::Active,
                'min_gift_cents' => $gifts['min_gift_cents'],
                'accepts_text' => $messages['accept_text'],
                'accepts_voice' => $messages['accept_voice'],
            ],
            'limits' => [
                'max_quantity' => SendGift::MAX_QUANTITY,
                'max_message_length' => (int) config('platform.gifts.max_message_length'),
                'max_voice_seconds' => (int) config('platform.gifts.max_voice_seconds'),
                'max_voice_kilobytes' => (int) config('platform.gifts.max_voice_kilobytes'),
                'min_deposit_cents' => (int) config('platform.wallet.min_deposit_cents'),
            ],
        ]);
    }

    /** POST /radio/{frequency}/regalos */
    public function store(SendGiftRequest $request, Frequency $frequency, SendGift $send, WalletLedger $ledger, GiftPreferences $preferences): JsonResponse
    {
        $station = $this->station($frequency);

        $transaction = $send->handle(
            sender: $request->user(),
            station: $station,
            gift: Gift::query()->findOrFail($request->integer('gift_id')),
            quantity: $request->integer('quantity'),
            idempotencyKey: (string) $request->validated('idempotency_key'),
            message: $request->validated('message'),
            voice: $request->file('voice'),
            voiceSeconds: $request->filled('voice_duration') ? (float) $request->input('voice_duration') : null,
            anonymous: $request->boolean('anonymous'),
        );

        $transaction->loadMissing('gift');

        return response()->json([
            'gift' => [
                'id' => $transaction->id,
                'name' => $transaction->gift->name,
                'emoji' => $transaction->gift->emoji,
                'animation' => $transaction->gift->animation,
                'quantity' => $transaction->quantity,
                'total_cents' => $transaction->total_cents,
            ],
            'balance_cents' => $ledger->balance($request->user()),
            'thank_you_message' => $preferences->gifts($station)['thank_you_message'],
        ], $transaction->wasRecentlyCreated ? 201 : 200);
    }

    private function station(Frequency $frequency): Station
    {
        return Station::query()->where('frequency_id', $frequency->id)->firstOrFail()->setRelation('frequency', $frequency);
    }
}
