<?php

namespace App\Domain\Streaming;

use App\Models\ListenerPeer;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;

/**
 * WebRTC handshake between the console of the current station (the only microphone) and each
 * listener. The console opens one peer connection per listener and the SDP travels through the
 * database: waiting → offering (console preparing) → offered → answered → connected.
 */
final class VoiceSignal
{
    public const IDLE = 'idle';

    public const WAITING = 'waiting';

    public const OFFERING = 'offering';

    public const OFFERED = 'offered';

    public const ANSWERED = 'answered';

    public const CONNECTED = 'connected';

    /** A peer silent for this many seconds is gone. */
    private const FRESH = 40;

    /** A handshake stuck in one step for this long can be requested again. */
    public const RETRY = 15;

    /** Listeners the console prepares per poll at most. */
    private const BATCH = 8;

    public function touch(string $id): ListenerPeer
    {
        $now = CarbonImmutable::now();
        $peer = ListenerPeer::query()->find($id);
        if (! $peer) {
            try {
                return ListenerPeer::query()->create(['id' => $id, 'state' => self::IDLE, 'last_seen' => $now]);
            } catch (QueryException) {
                $peer = ListenerPeer::query()->findOrFail($id);
            }
        }
        if ($peer->last_seen->lt($now->subSeconds(10))) {
            $peer->update(['last_seen' => $now]);
        }

        return $peer;
    }

    /** The listener asks for the live microphone of the current session. */
    public function request(string $id, string $session): void
    {
        $now = CarbonImmutable::now();
        $this->touch($id)->update(['session' => $session, 'state' => self::WAITING, 'offer' => null, 'answer' => null, 'state_at' => $now, 'last_seen' => $now]);
    }

    public function answer(string $id, string $session, string $sdp): bool
    {
        $now = CarbonImmutable::now();

        return ListenerPeer::query()->whereKey($id)->where('session', $session)->where('state', self::OFFERED)
            ->update(['answer' => $sdp, 'state' => self::ANSWERED, 'state_at' => $now, 'last_seen' => $now]) > 0;
    }

    public function leave(string $id): void
    {
        ListenerPeer::query()->whereKey($id)->delete();
    }

    /**
     * What the listener needs from the handshake: its step and, when ready, the console's offer.
     *
     * @return array{state: string, offer: ?string, since?: ?int}
     */
    public function voiceOf(ListenerPeer $peer, ?string $session): array
    {
        if (! $session || $peer->session !== $session) {
            return ['state' => self::IDLE, 'offer' => null];
        }

        return [
            'state' => $peer->state,
            'offer' => $peer->state === self::OFFERED ? $peer->offer : null,
            'since' => $peer->state_at?->getTimestampMs(),
        ];
    }

    /**
     * Listeners waiting for the microphone, marked as being prepared so the next poll does not offer them twice.
     *
     * @return list<string>
     */
    public function pending(string $session, int $max): array
    {
        $fresh = CarbonImmutable::now()->subSeconds(self::FRESH);
        $busy = ListenerPeer::query()->where('session', $session)->whereIn('state', [self::OFFERING, self::OFFERED, self::ANSWERED, self::CONNECTED])
            ->where('last_seen', '>=', $fresh)->count();
        $room = max(0, $max - $busy);
        if ($room === 0) {
            return [];
        }
        $ids = ListenerPeer::query()->where('session', $session)->where('state', self::WAITING)->where('last_seen', '>=', $fresh)
            ->orderBy('state_at')->limit(min($room, self::BATCH))->pluck('id')->all();
        if ($ids) {
            ListenerPeer::query()->whereIn('id', $ids)->update(['state' => self::OFFERING, 'state_at' => CarbonImmutable::now()]);
        }

        return $ids;
    }

    public function offer(string $session, string $id, string $sdp): bool
    {
        return ListenerPeer::query()->whereKey($id)->where('session', $session)->where('state', self::OFFERING)
            ->update(['offer' => $sdp, 'state' => self::OFFERED, 'state_at' => CarbonImmutable::now()]) > 0;
    }

    /** @return list<array{id: string, answer: string}> answers that arrived since the last poll */
    public function answers(string $session): array
    {
        $rows = ListenerPeer::query()->where('session', $session)->where('state', self::ANSWERED)->get(['id', 'answer']);
        if ($rows->isNotEmpty()) {
            ListenerPeer::query()->whereIn('id', $rows->modelKeys())->update(['state' => self::CONNECTED, 'state_at' => CarbonImmutable::now()]);
        }

        return $rows->map(fn (ListenerPeer $row) => ['id' => $row->id, 'answer' => (string) $row->answer])->values()->all();
    }

    /** @return list<string> listeners of the session that are still around; the console closes connections of the rest */
    public function alive(string $session): array
    {
        return ListenerPeer::query()->where('session', $session)->whereIn('state', [self::OFFERED, self::ANSWERED, self::CONNECTED])
            ->where('last_seen', '>=', CarbonImmutable::now()->subSeconds(self::FRESH))->pluck('id')->all();
    }

    /** Listeners hearing the live microphone right now. */
    public function connected(?string $session): int
    {
        return $session ? ListenerPeer::query()->where('session', $session)->where('state', self::CONNECTED)
            ->where('last_seen', '>=', CarbonImmutable::now()->subSeconds(self::FRESH))->count() : 0;
    }

    public function close(string $session): void
    {
        ListenerPeer::query()->where('session', $session)->update(['session' => null, 'state' => self::IDLE, 'offer' => null, 'answer' => null]);
    }

    /** Forgets peers of every station that left without saying goodbye. */
    public static function prune(): int
    {
        return ListenerPeer::acrossStations()->where('last_seen', '<', CarbonImmutable::now()->subHour())->delete();
    }
}
