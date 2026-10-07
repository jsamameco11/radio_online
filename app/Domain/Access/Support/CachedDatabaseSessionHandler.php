<?php

namespace App\Domain\Access\Support;

use Illuminate\Contracts\Auth\Guard;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Contracts\Container\Container;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Session\DatabaseSessionHandler;

/**
 * Database sessions (the security page lists them, suspensions close them) served from the
 * cache. The row is only written when the session changes, or every few minutes to keep its
 * last activity, so most requests skip both session round trips to the remote database.
 *
 * Whoever deletes session rows must forget them here too: AccountSessions::end().
 */
final class CachedDatabaseSessionHandler extends DatabaseSessionHandler
{
    /** Seconds an unchanged session goes without refreshing the last activity of its row. */
    private const TOUCH_EVERY = 300;

    public function __construct(
        ConnectionInterface $connection,
        string $table,
        int $minutes,
        Container $container,
        private readonly Cache $cache,
    ) {
        parent::__construct($connection, $table, $minutes, $container);
    }

    public static function key(string $sessionId): string
    {
        return 'session:'.$sessionId;
    }

    public function read($sessionId): string|false
    {
        $cached = $this->cache->get(self::key($sessionId));

        if (is_array($cached)) {
            $this->exists = true;

            return $cached['payload'];
        }

        $payload = parent::read($sessionId);

        if ($this->exists && $payload !== false) {
            $this->remember($sessionId, $payload, null, 0);
        }

        return $payload;
    }

    public function write($sessionId, $data): bool
    {
        $cached = $this->cache->get(self::key($sessionId));
        $userId = $this->container->bound(Guard::class) ? $this->userId() : null;

        if (is_array($cached)
            && $cached['payload'] === $data
            && $cached['user_id'] === $userId
            && $cached['touched_at'] > $this->currentTime() - self::TOUCH_EVERY) {
            return true;
        }

        $payload = $this->getDefaultPayload($data);
        // A session not read from the database (just started or regenerated) is inserted
        // straight away; performInsert() falls back to an update if the row already exists.
        $this->exists ? $this->performUpdate($sessionId, $payload) : $this->performInsert($sessionId, $payload);
        $this->exists = true;
        $this->remember($sessionId, $data, $userId, $this->currentTime());

        return true;
    }

    public function destroy($sessionId): bool
    {
        $this->cache->forget(self::key($sessionId));

        return parent::destroy($sessionId);
    }

    private function remember(string $sessionId, string $payload, mixed $userId, int $touchedAt): void
    {
        $this->cache->put(self::key($sessionId), [
            'payload' => $payload,
            'user_id' => $userId,
            'touched_at' => $touchedAt,
        ], $this->minutes * 60);
    }
}
