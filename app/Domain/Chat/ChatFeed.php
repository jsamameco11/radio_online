<?php

namespace App\Domain\Chat;

use App\Domain\Chat\Enums\ChatAuthor;
use App\Domain\Chat\Enums\ChatSticker;
use App\Domain\Chat\Support\HighlightTiers;
use App\Domain\Storage\MediaStorage;
use App\Http\Resources\ChatMessageResource;
use App\Http\Resources\Studio\ChatMessageResource as StudioChatMessageResource;
use App\Models\ChatMessage;
use App\Models\ChatMute;
use App\Models\Station;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * What the chat windows load: the latest messages of the chat on air, the
 * highlights still pinned, the silenced listeners and, for the studio, the
 * summary of the live transmission.
 */
final class ChatFeed
{
    private const RELATIONS = ['user', 'sender', 'hider', 'replyTo.user'];

    private const MAX_PINNED = 5;

    public function __construct(private readonly ChatRoom $room) {}

    /**
     * The public chat of a station, for anyone (signed in or not) and for
     * the viewer: whether they may write and why not.
     *
     * @return array<string, mixed>
     */
    public function forListeners(Station $station, ?User $viewer): array
    {
        $open = $this->room->isOpen($station);
        $mute = $open && $viewer !== null ? $this->room->mute($station, $viewer) : null;

        return [
            'open' => $open,
            'messages' => $open ? ChatMessageResource::collection($this->recent($station, visibleOnly: true))->resolve() : [],
            'pinned' => $open ? ChatMessageResource::collection($this->pinned($station))->resolve() : [],
            'viewer' => [
                'signed_in' => $viewer !== null,
                'verified' => $viewer?->hasVerifiedEmail() ?? false,
                'muted' => $mute !== null,
                'muted_until' => $mute?->until?->toIso8601String(),
            ],
            'limits' => self::limits(),
        ];
    }

    /**
     * The team's chat window: every recent message (hidden ones too, marked)
     * and the listeners it silenced.
     *
     * @return array<string, mixed>
     */
    public function forStudio(Station $station): array
    {
        return [
            'open' => $this->room->isOpen($station),
            'messages' => StudioChatMessageResource::collection($this->recent($station, visibleOnly: false))->resolve(),
            'pinned' => StudioChatMessageResource::collection($this->pinned($station))->resolve(),
            'mutes' => ChatMute::acrossStations()
                ->where('station_id', $station->id)
                ->active()
                ->with('user')
                ->latest()
                ->get()
                ->map(fn (ChatMute $mute) => [
                    'user_id' => $mute->user_id,
                    'name' => $mute->user->name,
                    'until' => $mute->until?->toIso8601String(),
                ])
                ->values()
                ->all(),
            'limits' => ['max_length' => (int) config('platform.chat.max_message_length'), 'stickers' => ChatSticker::catalog()],
        ];
    }

    /**
     * The chat of the live transmission on air (or the last one): how many
     * messages, how much the highlights credited to the station and who
     * supported it the most. Never what listeners paid or the fees.
     *
     * @return array<string, mixed>
     */
    public function summary(Station $station): array
    {
        $session = $this->room->latestSession($station);
        $openedAt = $this->room->openedAt($station);

        $scope = fn (): Builder => ChatMessage::acrossStations()
            ->where('station_id', $station->id)
            ->where('author', ChatAuthor::Listener->value)
            ->when($session !== null, fn (Builder $query) => $query->where('stream_session_id', $session?->id))
            ->when($session === null, fn (Builder $query) => $query->where('created_at', '>=', $openedAt ?? now()));

        $totals = $scope()->toBase()
            ->selectRaw('count(*) as messages, count(distinct user_id) as writers, coalesce(sum(case when highlight_cents > 0 then 1 else 0 end), 0) as highlighted, coalesce(sum(station_amount_cents), 0) as earned')
            ->first();

        $supporters = $scope()->toBase()
            ->where('highlight_cents', '>', 0)
            ->whereNotNull('user_id')
            ->selectRaw('user_id, count(*) as highlights, sum(station_amount_cents) as earned')
            ->groupBy('user_id')
            ->orderByDesc('earned')
            ->limit(5)
            ->get();
        $users = User::query()->whereKey($supporters->pluck('user_id'))->get(['id', 'name', 'avatar_path'])->keyBy('id');
        $storage = app(MediaStorage::class);

        return [
            'session' => $session === null ? null : [
                'title' => $session->title,
                'started_at' => $session->started_at->toIso8601String(),
                'ended_at' => $session->ended_at?->toIso8601String(),
            ],
            'messages' => (int) $totals->messages,
            'writers' => (int) $totals->writers,
            'highlighted' => (int) $totals->highlighted,
            'earned_cents' => (int) $totals->earned,
            'supporters' => $supporters->map(fn (object $row) => [
                'id' => (int) $row->user_id,
                'name' => $users[$row->user_id]->name ?? 'Oyente',
                'avatar_url' => $storage->url($users[$row->user_id]->avatar_path ?? null),
                'highlights' => (int) $row->highlights,
                'earned_cents' => (int) $row->earned,
            ])->values()->all(),
        ];
    }

    /**
     * @return array{max_length: int, tiers: list<array{cents: int, pin_seconds: int, level: int}>, stickers: list<array{key: string, label: string, pack: string, pack_label: string}>}
     */
    public static function limits(): array
    {
        return [
            'max_length' => (int) config('platform.chat.max_message_length'),
            'tiers' => HighlightTiers::all(),
            'stickers' => ChatSticker::catalog(),
        ];
    }

    /**
     * The latest messages, oldest first: since the station went live while it
     * is on air; the last ones it had otherwise (the studio reviews them).
     *
     * @return Collection<int, ChatMessage>
     */
    private function recent(Station $station, bool $visibleOnly): Collection
    {
        $openedAt = $this->room->openedAt($station);

        return ChatMessage::acrossStations()
            ->where('station_id', $station->id)
            ->when($visibleOnly, fn (Builder $query) => $query->visible())
            ->when($openedAt !== null, fn (Builder $query) => $query->where('created_at', '>=', $openedAt))
            ->with(self::RELATIONS)
            ->latest()
            ->orderByDesc('id')
            ->limit((int) config('platform.chat.history'))
            ->get()
            ->reverse()
            ->values();
    }

    /**
     * Highlights still pinned, the most valuable first.
     *
     * @return Collection<int, ChatMessage>
     */
    private function pinned(Station $station): Collection
    {
        return ChatMessage::acrossStations()
            ->where('station_id', $station->id)
            ->visible()
            ->pinned()
            ->with(self::RELATIONS)
            ->orderByDesc('highlight_cents')
            ->latest()
            ->limit(self::MAX_PINNED)
            ->get();
    }
}
