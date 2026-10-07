<?php

namespace App\Domain\Access\Support;

use App\Models\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\Eloquent\Model;

/**
 * The signed-in account (its user record, platform roles, direct permissions and station
 * memberships) kept in the cache, so a request does not ask the remote database who is signed
 * in and what they may do: role, permission and studio checks run in memory (spatie resolves
 * what each role allows from its own cached catalog).
 *
 * Forgotten whenever any of it changes (see ForgetAccount).
 */
final class AccountCache
{
    private const TTL = 86400;

    private const RELATIONS = ['roles', 'permissions', 'memberships'];

    public function __construct(private readonly Cache $cache) {}

    /** The account with its access already loaded, or null when it does not exist. */
    public function find(int $userId): ?User
    {
        $cached = $this->cache->get($this->key($userId));

        if (is_array($cached)) {
            return $this->hydrate($cached);
        }

        $user = User::query()->find($userId);

        return $user === null ? null : $this->hydrate($this->store($user));
    }

    /** Loads the access of an account found some other way (signing in). */
    public function preload(User $user): void
    {
        if (collect(self::RELATIONS)->every(fn (string $relation) => $user->relationLoaded($relation))) {
            return;
        }

        $cached = $this->cache->get($this->key($user->id));

        is_array($cached) ? $this->loadRelations($user, $cached) : $user->loadMissing(self::RELATIONS);
    }

    public function forget(int $userId): void
    {
        $this->cache->forget($this->key($userId));
    }

    /**
     * @return array{user: array<string, mixed>, roles: list<array<string, mixed>>, permissions: list<array<string, mixed>>, memberships: list<array<string, mixed>>}
     */
    private function store(User $user): array
    {
        $cached = ['user' => $user->getAttributes()];
        foreach (self::RELATIONS as $relation) {
            $cached[$relation] = $user->{$relation}()->get()->map(fn (Model $model) => $model->getAttributes())->values()->all();
        }

        $this->cache->put($this->key($user->id), $cached, self::TTL);

        return $cached;
    }

    /** @param  array<string, mixed>  $cached */
    private function hydrate(array $cached): User
    {
        $user = (new User)->newFromBuilder($cached['user']);
        $this->loadRelations($user, $cached);

        return $user;
    }

    /** @param  array<string, mixed>  $cached */
    private function loadRelations(User $user, array $cached): void
    {
        foreach (self::RELATIONS as $relation) {
            $user->setRelation($relation, $user->{$relation}()->getModel()->newQuery()->hydrate($cached[$relation]));
        }
    }

    private function key(int $userId): string
    {
        return "account:{$userId}";
    }
}
