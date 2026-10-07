<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Chat\Actions\ChangeChatMessageVisibility;
use App\Domain\Chat\Actions\MuteChatUser;
use App\Domain\Chat\Actions\ReplyAsStation;
use App\Domain\Chat\Actions\UnmuteChatUser;
use App\Domain\Chat\ChatFeed;
use App\Domain\Stations\Support\CurrentStation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\ChatVisibilityRequest;
use App\Http\Requests\Chat\MuteChatUserRequest;
use App\Http\Requests\Chat\ReplyChatMessageRequest;
use App\Http\Resources\Studio\ChatMessageResource;
use App\Models\ChatMessage;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Estudio › Chat en vivo: the team reads the chat of the station on air,
 * answers as the station and moderates it. The floating chat window of
 * every studio page talks to the same endpoints.
 */
class ChatController extends Controller
{
    public function __construct(private readonly CurrentStation $current) {}

    public function index(ChatFeed $feed): Response
    {
        $station = $this->current->get();

        return Inertia::render('Studio/Chat', [
            'feed' => $feed->forStudio($station),
            'summary' => $feed->summary($station),
        ]);
    }

    /** GET /chat/mensajes: the chat window loads and polls from here. */
    public function feed(ChatFeed $feed): JsonResponse
    {
        return response()->json($feed->forStudio($this->current->get()));
    }

    public function reply(ReplyChatMessageRequest $request, ReplyAsStation $reply): JsonResponse
    {
        $replyTo = $request->filled('reply_to') ? $this->find((string) $request->validated('reply_to')) : null;

        $message = $reply->handle($request->user(), $this->current->get(), (string) $request->validated('body'), (string) $request->validated('client_key'), $replyTo);
        $message->loadMissing(['user', 'sender', 'hider', 'replyTo.user']);

        return response()->json(['message' => ChatMessageResource::make($message)->resolve($request)], $message->wasRecentlyCreated ? 201 : 200);
    }

    public function visibility(ChatVisibilityRequest $request, string $message, ChangeChatMessageVisibility $change): JsonResponse
    {
        $found = $change->handle($this->find($message), $request->boolean('visible'), $request->user(), $this->current->get());
        $found->loadMissing(['user', 'sender', 'hider', 'replyTo.user']);

        return response()->json(['message' => ChatMessageResource::make($found)->resolve($request)]);
    }

    public function mute(MuteChatUserRequest $request, MuteChatUser $mute): JsonResponse
    {
        $station = $this->current->get();
        $listener = User::query()->findOrFail($request->integer('user_id'));

        if (! ChatMessage::query()->where('station_id', $station->id)->where('user_id', $listener->id)->exists()) {
            throw ValidationException::withMessages(['user_id' => 'Solo puedes silenciar a quien escribió en tu chat.']);
        }

        $muted = $mute->handle($station, $listener, $request->user(), $request->minutes());

        return response()->json([
            'mute' => ['user_id' => $listener->id, 'name' => $listener->name, 'until' => $muted->until?->toIso8601String()],
        ]);
    }

    public function unmute(Request $request, int $user, UnmuteChatUser $unmute): JsonResponse
    {
        $unmute->handle($this->current->get(), User::query()->findOrFail($user), $request->user());

        return response()->json(['user_id' => $user]);
    }

    /** A message of the current station only; any other id is a 404. */
    private function find(string $id): ChatMessage
    {
        abort_unless(Str::isUuid($id), 404);

        return ChatMessage::query()->where('station_id', $this->current->id())->findOrFail($id);
    }
}
