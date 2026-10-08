<?php

namespace App\Domain\Studio\Catalog\Actions;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Catalog\MusicCatalog;
use App\Domain\Studio\Library\Identify\Text;
use App\Models\Genre;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Adds a genre to the shared catalog for the current station, or changes one it added. No name or
 * other name may already belong to another genre, so a tag found on the internet lands on one genre.
 */
final class SaveGenre
{
    public function __construct(
        private readonly MusicCatalog $catalog,
        private readonly CurrentStation $current,
    ) {}

    /**
     * @param  array{name: string, family: string, aliases?: list<string>|null}  $data  Validated by CatalogGenreRequest.
     */
    public function handle(array $data, ?Genre $genre = null): Genre
    {
        $name = Str::ucfirst(trim((string) preg_replace('/\s+/u', ' ', $data['name'])));
        $aliases = array_values(array_filter(
            Text::unique($data['aliases'] ?? []),
            fn (string $alias) => Text::key($alias) !== Text::key($name),
        ));
        foreach ([$name, ...$aliases] as $index => $candidate) {
            $same = $this->catalog->genre($candidate);
            $taken = $same !== null && $same->id !== $genre?->id
                && in_array(Text::key($candidate), array_map(fn (string $known) => Text::key($known), $same->names()), true);
            if ($taken) {
                throw ValidationException::withMessages([$index === 0 ? 'name' : 'aliases' => Text::key($same->name) === Text::key($candidate)
                    ? "Ya existe el estilo «{$same->name}»."
                    : "«{$candidate}» ya es otro nombre de «{$same->name}».",
                ]);
            }
        }

        $values = ['name' => $name, 'family' => $data['family'], 'aliases' => $aliases ?: null];
        if ($genre !== null) {
            $genre->update($values);
        } else {
            $genre = Genre::query()->create([
                ...$values,
                'station_id' => $this->current->id(),
                'slug' => $this->catalog->genreSlug($name),
                'sort_order' => $this->catalog->nextGenreOrder(),
                'custom' => true,
            ]);
        }
        $this->catalog->forget();

        return $genre;
    }
}
