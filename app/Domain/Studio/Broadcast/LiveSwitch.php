<?php

namespace App\Domain\Studio\Broadcast;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Enums\LiveMode;
use App\Domain\Studio\Enums\LiveSource;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * The live switch: when the automatic music gives way to the live signal and when it comes back.
 *
 * The cut is a window of the main program (start, and an end once it is known) kept in the live
 * state, so every listener hears the switch at the same moment and the music after it starts
 * fresh. In automatic mode a scheduled live block cuts the music by itself as soon as the host is
 * connected (the console session, or the external signal answering) and the music comes back
 * when the block ends or the signal drops. The operator can always cut and return by hand; in
 * manual mode only the operator does.
 */
final class LiveSwitch
{
    /** Seconds an answer of the external signal is trusted before asking again. */
    private const PROBE_TTL = 10;

    public function __construct(
        private readonly CurrentStation $current,
        private readonly LiveDesk $desk,
        private readonly Timeline $timeline,
    ) {}

    /** The cut to honour now, reconciled with the schedule and the source in automatic mode. */
    public function window(array $config, array $live, int $now): ?array
    {
        if (! $config['on_air']) {
            return null;
        }

        return $config['live_mode'] === LiveMode::Auto->value ? $this->reconcile($config, $live, $now) : $live['window'];
    }

    public static function isOpen(?array $window, int $now): bool
    {
        return $window !== null && $window['start'] <= $now && ($window['end'] === null || $window['end'] > $now);
    }

    /** «Ir al vivo»: cuts the automatic music now until the operator returns to it. */
    public function cut(string $title): ?array
    {
        $now = BroadcastClock::nowMs();
        $slot = $this->timeline->liveSlot($now);

        return $this->desk->update(fn (array $live) => self::isOpen($live['window'], $now) ? [] : [
            'window' => [
                'start' => $now,
                'end' => null,
                'auto' => false,
                'bed' => false,
                'slot' => $slot?->id,
                'title' => $slot?->title ?: $title,
            ],
            'skip' => null,
        ])['window'];
    }

    /**
     * «Volver a la música»: closes the cut now. During a scheduled live block the automatic switch
     * leaves that block alone afterwards, so it does not cut the music again.
     */
    public function resume(): void
    {
        $now = BroadcastClock::nowMs();
        $slot = $this->timeline->liveSlot($now);
        $this->desk->update(fn (array $live) => [
            'window' => self::isOpen($live['window'], $now) ? [...$live['window'], 'end' => $now] : $live['window'],
            'skip' => $live['window']['slot'] ?? $slot?->id,
        ]);
    }

    /** When the console session ends, a cut fed by the console ends with it. */
    public static function closeOnHangUp(array $live, array $config): array
    {
        $now = BroadcastClock::nowMs();
        if ($config['live_source'] !== LiveSource::Console->value || ! self::isOpen($live['window'], $now)) {
            return [];
        }

        return ['window' => [...$live['window'], 'end' => $now]];
    }

    /** Whether the external signal answers right now (cached for a few seconds). */
    public function externalOnline(string $url): bool
    {
        if ($url === '') {
            return false;
        }

        return (bool) Cache::remember($this->current->key('external.'.md5($url)), self::PROBE_TTL, function () use ($url) {
            try {
                $response = Http::connectTimeout(3)->timeout(4)->withOptions(['stream' => true])->get($url);
                $online = $response->successful();
                $response->close();

                return $online;
            } catch (Throwable) {
                return false;
            }
        });
    }

    private function reconcile(array $config, array $live, int $now): ?array
    {
        $window = $live['window'];
        $open = self::isOpen($window, $now);
        if ($open && ! $window['auto']) {
            return $window;
        }

        $slot = $this->timeline->liveSlot($now);
        $since = $slot && $live['skip'] !== $slot->id ? $this->connectedSince($config, $live, $now) : null;
        if ($slot && $since !== null) {
            $end = $slot->endsAt()->getTimestampMs();
            if ($open && $window['slot'] === $slot->id) {
                return $window['end'] === $end ? $window : $this->store([...$window, 'end' => $end]);
            }

            return $this->store([
                'start' => max($slot->starts_at->getTimestampMs(), $since),
                'end' => $end,
                'auto' => true,
                'bed' => $slot->bed,
                'slot' => $slot->id,
                'title' => $slot->title,
            ]);
        }

        return $open ? $this->store([...$window, 'end' => $now]) : $window;
    }

    /** Since when the host is connected, or null when nobody is. */
    private function connectedSince(array $config, array $live, int $now): ?int
    {
        if ($config['live_source'] !== LiveSource::External->value) {
            return $live['session'] ? (int) $live['started_at'] : null;
        }
        $key = $this->current->key('external.since');
        if (! $this->externalOnline((string) $config['live_url'])) {
            Cache::forget($key);

            return null;
        }

        return (int) Cache::rememberForever($key, fn () => $now);
    }

    private function store(array $window): ?array
    {
        return $this->desk->update(fn () => ['window' => $window])['window'];
    }
}
