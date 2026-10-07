<?php

namespace App\Domain\Studio\Library\Identify;

use App\Domain\Studio\Catalog\Names;

/** What is known of a song before asking the internet: its name, author, co-authors and length. */
final class SongQuery
{
    public readonly string $title;

    public readonly string $artist;

    /** @var list<string> */
    public readonly array $featured;

    /** @var list<string> The cuts the name asks for (live, acoustic, remix…). */
    public readonly array $versions;

    /** @param  list<string>  $featured */
    public function __construct(string $title, string $artist = '', array $featured = [], public readonly ?float $duration = null)
    {
        $this->versions = Names::versions($title);
        $this->title = Names::cleanTitle($title);
        $this->artist = Names::cleanArtist($artist);
        $this->featured = Names::unique(array_map(fn (string $name) => Names::cleanArtist($name), $featured));
    }

    /** @return list<string> */
    public function names(): array
    {
        return Names::unique([$this->artist, ...$this->featured]);
    }

    public function cacheKey(): string
    {
        return 'identify:'.sha1(implode('|', [
            Names::key($this->title),
            Names::key($this->artist),
            $this->duration ? (int) round($this->duration / 3) : '',
            implode(',', $this->versions),
        ]));
    }
}
