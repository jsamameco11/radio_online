<?php

namespace App\Domain\Chat\Support;

use App\Domain\Stations\Support\StationPreferences;
use App\Models\Station;

/**
 * The "moderation" settings group of a station as the chat applies it:
 * blocked words are masked, links can be refused, slow mode spaces out the
 * messages of each listener and much-reported messages hide themselves.
 */
final readonly class ChatModeration
{
    /**
     * @param  list<string>  $blockedWords
     */
    public function __construct(
        public array $blockedWords,
        public int $slowModeSeconds,
        public bool $blockLinks,
        public bool $autoHideReported,
        public int $autoHideThreshold,
    ) {}

    public static function of(Station $station): self
    {
        $values = app(StationPreferences::class)->get($station, 'moderation');

        return new self(
            array_values(array_map('strval', (array) $values['blocked_words'])),
            max(0, (int) $values['slow_mode_seconds']),
            (bool) $values['block_links'],
            (bool) $values['auto_hide_reported'],
            max(1, (int) $values['auto_hide_threshold']),
        );
    }

    /** "mira www.ejemplo.com", "https://…", "ejemplo.pe/oferta" */
    public static function containsLink(string $text): bool
    {
        return (bool) preg_match('~(?:https?://|www\.)\S+|\b[\pL\pN-]+\.(?:com|net|org|info|biz|io|co|me|ly|gg|tv|app|xyz|pe|ar|mx|cl|es|bo|ec|uy|py|ve)\b~iu', $text);
    }
}
