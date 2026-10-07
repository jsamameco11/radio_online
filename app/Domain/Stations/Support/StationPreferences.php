<?php

namespace App\Domain\Stations\Support;

use App\Models\Station;
use InvalidArgumentException;

/**
 * The settings groups the station management screens own, with their
 * defaults. Other features read them from here:
 *
 *     app(StationPreferences::class)->get($station, 'privacy')['allow_anonymous_gifts']
 */
final class StationPreferences
{
    public const DEFAULTS = [
        'profile' => [
            'website' => null,
            'instagram' => null,
            'facebook' => null,
            'tiktok' => null,
            'youtube' => null,
            'x' => null,
            'whatsapp' => null,
        ],
        'moderation' => [
            'blocked_words' => [],
            'slow_mode_seconds' => 0,
            'block_links' => true,
            'auto_hide_reported' => true,
            'auto_hide_threshold' => 3,
            'notify_team_on_report' => true,
        ],
        'notifications' => [
            'recipients' => 'owner',
            'email_new_follower' => false,
            'email_gift_received' => true,
            'email_report_received' => true,
            'email_stream_problems' => true,
            'email_weekly_summary' => true,
        ],
        'privacy' => [
            'show_listener_count' => true,
            'show_follower_count' => true,
            'show_top_supporters' => true,
            'allow_anonymous_gifts' => true,
            'show_team' => false,
        ],
        'security' => [
            'require_two_factor' => false,
        ],
    ];

    public const SLOW_MODE_OPTIONS = [0, 5, 10, 30, 60, 120, 300];

    public const RECIPIENTS = ['owner' => 'Solo el propietario', 'managers' => 'Propietario y administradores', 'team' => 'Todo el equipo'];

    public function __construct(private readonly StationSettings $settings) {}

    /**
     * @return array<string, mixed>
     */
    public function get(Station $station, string $group): array
    {
        return $this->settings->get($station, $group, self::defaults($group));
    }

    /**
     * Stores the known keys of a group and returns the keys whose value changed.
     *
     * @param  array<string, mixed>  $values
     * @return list<string>
     */
    public function put(Station $station, string $group, array $values): array
    {
        $before = $this->get($station, $group);
        $values = array_intersect_key($values, self::defaults($group));
        $this->settings->put($station, $group, $values);

        return array_keys(array_filter($values, fn (mixed $value, string $key) => $before[$key] !== $value, ARRAY_FILTER_USE_BOTH));
    }

    /**
     * @return array<string, mixed>
     */
    private static function defaults(string $group): array
    {
        return self::DEFAULTS[$group] ?? throw new InvalidArgumentException("Unknown station settings group [{$group}].");
    }
}
