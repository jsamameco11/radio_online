<?php

namespace App\Domain\Platform\Listeners;

use Illuminate\Database\DatabaseManager;
use Illuminate\Foundation\Events\DiagnosingHealth;

/**
 * The uptime probe (/up) fails when the database cannot be reached. It also leaves the
 * worker's persistent connection open, which is how a release warms every PHP worker.
 */
final class ReachDatabase
{
    public function __construct(private readonly DatabaseManager $db) {}

    public function handle(DiagnosingHealth $event): void
    {
        $this->db->connection()->getPdo();
    }
}
