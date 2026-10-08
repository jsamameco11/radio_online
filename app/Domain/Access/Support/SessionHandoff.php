<?php

namespace App\Domain\Access\Support;

use App\Domain\Platform\PlatformHost;
use App\Models\User;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Str;

/**
 * Carries a signed-in account between the listeners' site and the creators'
 * console, which keep separate sessions, so nobody signs in with Google twice.
 * The host the person is on issues a single-use pass valid for a minute (only
 * its hash is stored) and the other host redeems it. The control panel never
 * takes one: the staff signs in there with a username and password.
 */
final class SessionHandoff
{
    /** Hosts that accept a pass, by the segment of /ir/{segment}. */
    public const TARGETS = ['escuchar' => PlatformHost::Public, 'consola' => PlatformHost::Studio];

    private const TTL_SECONDS = 60;

    public function __construct(private readonly Repository $cache) {}

    /** Link from the current host to $path on $target that keeps the session: /ir/escuchar?a=%2Fobten-tu-frecuencia */
    public static function link(PlatformHost $target, string $path = '/'): string
    {
        $segment = array_search($target, self::TARGETS, true);

        return $segment === false ? $target->url($path) : '/ir/'.$segment.'?'.http_build_query(['a' => $path]);
    }

    /** Only paths on the destination host are followed: "https://…" or "//…" open its home instead. */
    public static function safePath(mixed $path): string
    {
        return is_string($path) && str_starts_with($path, '/') && ! str_starts_with($path, '//') && ! str_contains($path, '\\') ? $path : '/';
    }

    /** Single-use address on $target that signs $user in there and opens $path. */
    public function issue(User $user, PlatformHost $target, string $path): string
    {
        $pass = Str::random(64);
        $this->cache->put($this->key($pass), ['user' => $user->getKey(), 'host' => $target->value, 'path' => $path], self::TTL_SECONDS);

        return $target->url('/acceso/'.$pass);
    }

    /**
     * The account and page a pass opens on $host; null when it was already used,
     * expired, was issued for another host or the account was suspended meanwhile.
     *
     * @return array{user: User, path: string}|null
     */
    public function redeem(string $pass, PlatformHost $host): ?array
    {
        $issued = $this->cache->pull($this->key($pass));
        if (! is_array($issued) || $issued['host'] !== $host->value) {
            return null;
        }

        $user = User::query()->find($issued['user']);

        return $user === null || $user->isSuspended() ? null : ['user' => $user, 'path' => $issued['path']];
    }

    private function key(string $pass): string
    {
        return 'session-handoff:'.hash('sha256', $pass);
    }
}
