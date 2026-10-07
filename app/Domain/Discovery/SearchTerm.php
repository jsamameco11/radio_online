<?php

namespace App\Domain\Discovery;

use App\Domain\Frequencies\FrequencyDial;

/**
 * What a listener typed in the search box, understood: a frequency
 * ("89.3", "101-7 FM"), a hashtag ("#Fútbol") or free text (a name, a
 * category, a topic).
 */
final readonly class SearchTerm
{
    /**
     * @param  array{name: string, slug: string}|null  $hashtag
     */
    private function __construct(
        public string $raw,
        public ?string $frequency,
        public ?array $hashtag,
        public string $text,
    ) {}

    public static function parse(string $value): self
    {
        $raw = trim(preg_replace('/\s+/u', ' ', $value) ?? '');

        if (str_starts_with($raw, '#')) {
            return new self($raw, null, Hashtags::normalize($raw), '');
        }

        return new self($raw, FrequencyDial::normalize($raw), null, $raw);
    }

    public function isEmpty(): bool
    {
        return $this->raw === '' || ($this->hashtag === null && $this->text === '');
    }
}
