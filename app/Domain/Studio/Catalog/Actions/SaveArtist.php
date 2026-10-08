<?php

namespace App\Domain\Studio\Catalog\Actions;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Catalog\ArtistKind;
use App\Domain\Studio\Catalog\MusicCatalog;
use App\Domain\Studio\Library\Identify\Text;
use App\Models\Artist;
use App\Models\Genre;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Adds an artist the shared catalog does not know yet, for the current station, or changes one the
 * station added: its other spellings, kind, country and the genres it plays (the first is the main one).
 * No name or spelling may already belong to another artist.
 */
final class SaveArtist
{
    public function __construct(
        private readonly MusicCatalog $catalog,
        private readonly CurrentStation $current,
    ) {}

    /**
     * @param  array{name: string, aliases?: list<string>|null, kind?: ?string, country?: ?string, genre_ids?: list<string>}  $data  Validated by CatalogArtistRequest.
     */
    public function handle(array $data, ?Artist $artist = null): Artist
    {
        $name = trim((string) preg_replace('/\s+/u', ' ', $data['name']));
        $aliases = array_values(array_filter(
            Text::unique($data['aliases'] ?? []),
            fn (string $alias) => Text::key($alias) !== Text::key($name),
        ));
        foreach ([$name, ...$aliases] as $index => $candidate) {
            $other = $this->catalog->artist($candidate);
            if ($other !== null && $other->id !== $artist?->id) {
                $same = Text::key($other->name) === Text::key($candidate);
                throw ValidationException::withMessages($index === 0
                    ? ['name' => $same ? 'Este artista ya está en el catálogo.' : "«{$candidate}» ya es un nombre de {$other->name}."]
                    : ['aliases' => $same ? "{$other->name} ya está en el catálogo como otro artista." : "«{$candidate}» ya es un nombre de {$other->name}."]);
            }
        }

        return DB::transaction(function () use ($data, $artist, $name, $aliases) {
            $values = [
                'name' => $name,
                'aliases' => $aliases ?: null,
                'kind' => ArtistKind::tryFrom((string) ($data['kind'] ?? ''))?->value,
                'country' => $data['country'] ?? null,
            ];
            if ($artist !== null) {
                $artist->update($values);
            } else {
                $artist = Artist::query()->create([
                    ...$values,
                    'station_id' => $this->current->id(),
                    'slug' => $this->catalog->artistSlug($name),
                    'source' => Artist::MANUAL,
                ]);
            }
            $ids = $data['genre_ids'] ?? [];
            $genres = Genre::query()->whereKey($ids)->get()->sortBy(fn (Genre $genre) => array_search($genre->id, $ids, true))->values();
            $this->catalog->attachGenres($artist, $genres);
            $this->catalog->forget();

            return $artist;
        });
    }
}
