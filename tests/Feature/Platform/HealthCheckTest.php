<?php

namespace Tests\Feature\Platform;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\DatabaseManager;
use Mockery;
use PDOException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    #[Test]
    public function the_uptime_probe_reaches_the_database(): void
    {
        $this->get($this->publicUrl('/up'))->assertOk()->assertSee('OK');
    }

    #[Test]
    public function the_uptime_probe_fails_when_the_database_is_unreachable(): void
    {
        $connection = Mockery::mock(ConnectionInterface::class);
        $connection->shouldReceive('getPdo')->andThrow(new PDOException('could not connect to server'));
        $db = Mockery::mock(DatabaseManager::class);
        $db->shouldReceive('connection')->andReturn($connection);
        $this->app->instance(DatabaseManager::class, $db);

        $this->get($this->publicUrl('/up'))->assertServerError();
    }
}
