<?php

namespace App\Domain\Stories\Support;

use App\Domain\Stories\Enums\StoryBackground;

/** What a story may be (config "platform.stories") and how long each one stays on screen. */
final class StoryLimits
{
    public const IMAGE_MS = 6000;

    public const TEXT_MIN_MS = 6000;

    public const TEXT_MAX_MS = 10000;

    public static function lifetimeHours(): int
    {
        return (int) config('platform.stories.lifetime_hours');
    }

    public static function maxActive(): int
    {
        return (int) config('platform.stories.max_active');
    }

    public static function maxText(): int
    {
        return (int) config('platform.stories.max_text');
    }

    public static function maxVideoSeconds(): int
    {
        return (int) config('platform.stories.max_video_seconds');
    }

    /** Reading time of a text story: longer texts stay a little longer. */
    public static function textDuration(string $text): int
    {
        return max(self::TEXT_MIN_MS, min(self::TEXT_MAX_MS, 4000 + mb_strlen($text) * 30));
    }

    /**
     * The same limits for the composer of the studio.
     *
     * @return array<string, mixed>
     */
    public static function forComposer(): array
    {
        return [
            'max_active' => self::maxActive(),
            'max_text' => self::maxText(),
            'lifetime_hours' => self::lifetimeHours(),
            'image_types' => config('platform.stories.image_types'),
            'max_image_mb' => (int) config('platform.stories.max_image_mb'),
            'video_types' => config('platform.stories.video_types'),
            'max_video_mb' => (int) config('platform.stories.max_video_mb'),
            'max_video_seconds' => self::maxVideoSeconds(),
            'backgrounds' => collect(StoryBackground::cases())
                ->map(fn (StoryBackground $background) => ['value' => $background->value, 'label' => $background->label()])
                ->all(),
        ];
    }
}
