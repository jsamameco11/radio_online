<?php

namespace App\Domain\Platform\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Platform\PlatformSettings;
use App\Models\User;

/** Saves the platform switches and audits what actually changed. */
final class UpdatePlatformSettings
{
    public function __construct(
        private readonly PlatformSettings $settings,
        private readonly AuditTrail $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, array{0: mixed, 1: mixed}>
     */
    public function handle(array $values, User $actor): array
    {
        $changes = $this->settings->put($values, $actor);

        if ($changes !== []) {
            $this->audit->record('platform.settings_updated', null, ['changes' => $changes], $actor);
        }

        return $changes;
    }
}
