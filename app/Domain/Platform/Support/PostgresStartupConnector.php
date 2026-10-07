<?php

namespace App\Domain\Platform\Support;

use Illuminate\Database\Connectors\PostgresConnector;

/**
 * Sends the search_path in the connection startup packet instead of running "set search_path"
 * once connected: against a remote database (Supabase) that statement cost one round trip on
 * every request, persistent connections included.
 */
final class PostgresStartupConnector extends PostgresConnector
{
    protected function getDsn(array $config)
    {
        $searchPath = $config['search_path'] ?? $config['schema'] ?? null;

        if ($searchPath !== null) {
            $config['server_options'] = ['search_path' => implode(',', $this->parseSearchPath($searchPath))] + ($config['server_options'] ?? []);
        }

        return parent::getDsn($config);
    }

    protected function configureSearchPath($connection, $config) {}
}
