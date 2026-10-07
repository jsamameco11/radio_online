<?php

namespace App\Domain\Gifts\Support;

use App\Domain\Stations\Support\StationSettings;
use App\Models\Station;

/**
 * The "gifts" and "messages" settings groups of a station, with their
 * defaults: whether it accepts gifts, the minimum per gift, the thank-you
 * note, and which kinds of messages it takes and how they are filtered.
 */
final class GiftPreferences
{
    public const GIFTS = 'gifts';

    public const MESSAGES = 'messages';

    public function __construct(private readonly StationSettings $settings) {}

    /**
     * @return array{enabled: bool, min_gift_cents: int, thank_you_message: string}
     */
    public function gifts(Station $station): array
    {
        $values = $this->settings->get($station, self::GIFTS, [
            'enabled' => true,
            'min_gift_cents' => 100,
            'thank_you_message' => '¡Gracias por tu regalo! Nos alegra que nos escuches.',
        ]);

        return [
            'enabled' => (bool) $values['enabled'],
            'min_gift_cents' => (int) $values['min_gift_cents'],
            'thank_you_message' => (string) $values['thank_you_message'],
        ];
    }

    /**
     * @return array{accept_text: bool, accept_voice: bool, auto_hide_filtered: bool, blocked_words: list<string>}
     */
    public function messages(Station $station): array
    {
        $values = $this->settings->get($station, self::MESSAGES, [
            'accept_text' => true,
            'accept_voice' => true,
            'auto_hide_filtered' => false,
            'blocked_words' => [],
        ]);

        return [
            'accept_text' => (bool) $values['accept_text'],
            'accept_voice' => (bool) $values['accept_voice'],
            'auto_hide_filtered' => (bool) $values['auto_hide_filtered'],
            'blocked_words' => array_values(array_map('strval', (array) $values['blocked_words'])),
        ];
    }

    /**
     * @param  array{enabled: bool, min_gift_cents: int, thank_you_message: string}  $values
     */
    public function updateGifts(Station $station, array $values): void
    {
        $this->settings->put($station, self::GIFTS, $values);
    }

    /**
     * @param  array{accept_text: bool, accept_voice: bool, auto_hide_filtered: bool, blocked_words: list<string>}  $values
     */
    public function updateMessages(Station $station, array $values): void
    {
        $this->settings->put($station, self::MESSAGES, $values);
    }
}
