<?php

namespace App\Domain\Platform;

use App\Models\PlatformSetting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Platform-wide switches the staff changes at runtime, cached forever and
 * forgotten on every write. Unknown keys are ignored; missing keys fall back
 * to DEFAULTS, so a new option never needs a migration.
 *
 *     app(PlatformSettings::class)->get('frequency_requests_open')
 */
final class PlatformSettings
{
    public const DEFAULTS = [
        // New listener accounts can sign up on the public host.
        'registrations_open' => true,
        // Listeners can ask for a frequency ("Obtén tu frecuencia") and stations can ask to move.
        'frequency_requests_open' => true,
        // Notice shown on every page while not empty.
        'maintenance_banner' => null,
        // Pending requests a single user may have at the same time.
        'max_pending_requests' => 1,
        // Seconds without a heartbeat before an on-air station is flagged by the monitor.
        'stale_heartbeat_seconds' => 90,
    ];

    private const CACHE_KEY = 'platform:settings';

    /**
     * @return array<string, mixed>
     */
    public function all(): array
    {
        $stored = Cache::rememberForever(self::CACHE_KEY, fn () => PlatformSetting::query()->pluck('value', 'key')->all());

        return array_replace(self::DEFAULTS, array_intersect_key($stored, self::DEFAULTS));
    }

    public function get(string $key): mixed
    {
        return $this->all()[$key] ?? null;
    }

    /**
     * Stores the given known keys and returns what actually changed, as [key => [before, after]].
     *
     * @param  array<string, mixed>  $values
     * @return array<string, array{0: mixed, 1: mixed}>
     */
    public function put(array $values, ?User $editor = null): array
    {
        $before = $this->all();
        $changes = [];

        DB::transaction(function () use ($values, $before, $editor, &$changes) {
            foreach (array_intersect_key($values, self::DEFAULTS) as $key => $value) {
                if ($before[$key] === $value) {
                    continue;
                }

                PlatformSetting::query()->updateOrCreate(
                    ['key' => $key],
                    ['value' => $value, 'updated_by' => $editor?->id, 'updated_at' => now()],
                );
                $changes[$key] = [$before[$key], $value];
            }
        });

        Cache::forget(self::CACHE_KEY);

        return $changes;
    }
}
