<?php

namespace App\Domain\Stations\Support;

use App\Models\Station;
use LogicException;

/**
 * The station a request (or a job) works on.
 *
 * Studio routes and listener endpoints set it from the URL; models using
 * App\Models\Concerns\BelongsToStation are then filtered to it and filled
 * with it, and the broadcast engine keys its caches with it. It is bound as
 * a scoped singleton, so it never leaks from one request or job to another.
 */
final class CurrentStation
{
    private ?Station $station = null;

    public function set(Station $station): void
    {
        $this->station = $station;
    }

    public function clear(): void
    {
        $this->station = null;
    }

    public function has(): bool
    {
        return $this->station !== null;
    }

    public function get(): Station
    {
        return $this->station ?? throw new LogicException('No station is selected for this request.');
    }

    public function id(): ?int
    {
        return $this->station?->id;
    }

    /**
     * Cache key namespaced to the current station: "station:42:config".
     */
    public function key(string $name): string
    {
        return 'station:'.$this->get()->id.':'.$name;
    }

    /**
     * Runs $callback with $station selected, restoring the previous one afterwards.
     *
     * @template TResult
     *
     * @param  callable(Station): TResult  $callback
     * @return TResult
     */
    public function within(Station $station, callable $callback): mixed
    {
        $previous = $this->station;
        $this->station = $station;

        try {
            return $callback($station);
        } finally {
            $this->station = $previous;
        }
    }
}
