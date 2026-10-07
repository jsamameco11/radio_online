<?php

namespace App\Domain\Audit;

use App\Models\AuditLog;
use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * The kinds of action recorded so far, for the audit filters. Listing them reads the whole
 * (ever growing) audit table, so the list is kept for a few minutes: a new kind shows up then.
 */
final class AuditActions
{
    private const TTL = 600;

    public function __construct(private readonly Cache $cache) {}

    /** @return list<string> */
    public function all(): array
    {
        return $this->cache->remember('audit:actions', self::TTL, fn () => AuditLog::query()
            ->distinct()
            ->orderBy('action')
            ->pluck('action')
            ->all());
    }
}
