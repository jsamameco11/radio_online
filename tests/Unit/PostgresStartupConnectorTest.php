<?php

namespace Tests\Unit;

use App\Domain\Platform\Support\PostgresStartupConnector;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class PostgresStartupConnectorTest extends TestCase
{
    /** @param  array<string, mixed>  $config */
    private function dsn(array $config): string
    {
        return (new ReflectionMethod(PostgresStartupConnector::class, 'getDsn'))
            ->invoke(new PostgresStartupConnector, ['host' => 'db.example.com', 'database' => 'postgres', 'port' => 5432, ...$config]);
    }

    #[Test]
    public function the_search_path_travels_in_the_startup_packet(): void
    {
        $this->assertStringEndsWith(";options='-c search_path=turadio'", $this->dsn(['search_path' => 'turadio']));
    }

    #[Test]
    public function several_schemas_are_kept_in_order(): void
    {
        $this->assertStringEndsWith(";options='-c search_path=turadio,public'", $this->dsn(['search_path' => 'turadio, public']));
    }

    #[Test]
    public function other_server_options_are_kept(): void
    {
        $this->assertStringEndsWith(
            ";options='-c search_path=turadio -c statement_timeout=5000'",
            $this->dsn(['search_path' => 'turadio', 'server_options' => ['statement_timeout' => 5000]]),
        );
    }

    #[Test]
    public function without_a_search_path_the_dsn_is_untouched(): void
    {
        $this->assertStringNotContainsString('options=', $this->dsn([]));
    }
}
