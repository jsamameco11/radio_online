<?php

namespace App\Domain\Studio\Library\Identify;

/**
 * What is known of a song before asking the internet: its name, author, co-authors and length,
 * and what the name itself tells: whether it is live, the cut it asks for (remix, acoustic…),
 * guests written in it and who sang it first when it says it is a cover.
 */
final class SongQuery
{
    public readonly string $title;

    public readonly string $artist;

    public readonly bool $live;

    /** @var list<string> Cuts the name asks for («acoustic», «remix»…). */
    public readonly array $cuts;

    /** @var list<string> Co-authors by name. */
    public readonly array $featured;

    /** @var list<string> Co-authors by social handle («@losamigosoficial»), named once a database credits them. */
    public readonly array $handles;

    /** @var list<string> Who may have sung it first, when the name says it is a cover («(Leonard Cohen - Cover)»). */
    public readonly array $originals;

    /**
     * @param  list<string>  $featured
     * @param  list<string>  $originals
     */
    public function __construct(
        string $title,
        string $artist = '',
        array $featured = [],
        public readonly ?float $duration = null,
        array $originals = [],
    ) {
        $this->live = Text::isLive($title);
        $this->cuts = Text::cuts($title);
        $this->originals = Text::unique([...$originals, ...Text::coverOf($title)]);
        $this->title = Text::cleanTitle($title) ?: trim($title);
        $this->artist = Text::cleanArtist($artist);
        $names = Text::unique([...array_map(fn (string $name) => Text::isHandle($name) ? $name : Text::cleanArtist($name), $featured), ...Text::featuredIn($title)]);
        $this->featured = array_values(array_filter($names, fn (string $name) => ! Text::isHandle($name)));
        $this->handles = array_values(array_filter($names, fn (string $name) => Text::isHandle($name)));
    }

    /** The same song once its author was found inside the name it came with. */
    public function withArtist(string $artist, string $title): self
    {
        $notes = implode(' ', array_filter([$this->live ? 'live' : '', ...$this->cuts]));

        return new self($notes !== '' ? "{$title} ({$notes})" : $title, $artist, [...$this->featured, ...$this->handles], $this->duration, $this->originals);
    }

    /** @return list<string> The author and the co-authors. */
    public function names(): array
    {
        return array_values(array_filter([$this->artist, ...$this->featured], fn (string $name) => Text::key($name) !== ''));
    }

    public function cacheKey(): string
    {
        return sha1(implode('|', [
            Text::key($this->title),
            Text::key($this->artist),
            $this->duration ? (int) round($this->duration / 3) : '',
            $this->live ? 'live' : '',
            implode(',', $this->cuts),
        ]));
    }
}
