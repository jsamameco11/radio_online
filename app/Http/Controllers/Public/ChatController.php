<?php

namespace App\Http\Controllers\Public;

use App\Domain\Chat\Actions\PostChatMessage;
use App\Domain\Chat\Actions\ReportChatMessage;
use App\Domain\Chat\ChatFeed;
use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Wallet\WalletLedger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\PostChatMessageRequest;
use App\Http\Requests\Public\ReportContentRequest;
use App\Http\Resources\ChatMessageResource;
use App\Models\ChatMessage;
use App\Models\Frequency;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** The live chat of a station page: its history, posting (and highlighting) and reports. */
class ChatController extends Controller
{
    public function __construct(private readonly StationDirectory $stations) {}

    /** GET /radio/{frequency}/chat: anyone can read; the page polls here without WebSocket. */
    public function index(Request $request, Frequency $frequency, ChatFeed $feed): JsonResponse
    {
        return response()->json($feed->forListeners($this->stations->onFrequencyOrFail($frequency), $request->user()));
    }

    /** POST /radio/{frequency}/chat */
    public function store(PostChatMessageRequest $request, Frequency $frequency, PostChatMessage $post, WalletLedger $ledger): JsonResponse
    {
        $message = $post->handle(
            author: $request->user(),
            station: $this->stations->onFrequencyOrFail($frequency),
            body: (string) $request->validated('body'),
            clientKey: (string) $request->validated('client_key'),
            highlightCents: $request->highlightCents(),
            sticker: $request->sticker(),
        );

        $message->loadMissing(['user', 'replyTo.user']);

        return response()->json([
            'message' => ChatMessageResource::make($message)->resolve($request),
            'balance_cents' => $message->isHighlighted() ? $ledger->balance($request->user()) : null,
        ], $message->wasRecentlyCreated ? 201 : 200);
    }

    /** POST /radio/{frequency}/chat/{message}/reportar */
    public function report(ReportContentRequest $request, Frequency $frequency, string $message, ReportChatMessage $report): JsonResponse
    {
        abort_unless(Str::isUuid($message), 404);
        $station = $this->stations->onFrequencyOrFail($frequency);
        $found = ChatMessage::acrossStations()->where('station_id', $station->id)->visible()->findOrFail($message);

        $report->handle($request->user(), $station, $found, $request->reason(), $request->details());

        return response()->json(['message' => 'Gracias por avisarnos. El equipo de moderación revisará el mensaje.']);
    }
}
