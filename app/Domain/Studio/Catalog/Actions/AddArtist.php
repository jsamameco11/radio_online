<?php

namespace App\Domain\Studio\Catalog\Actions;

use App\Domain\Studio\Catalog\ArtistKind;
use App\Domain\Studio\Catalog\MusicCatalog;
use App\Models\Artist;
use App\Models\Genre;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Adds an artist the shared catalog does not know yet, with the genres it plays. */
final class AddArtist
{
    public function __construct(private readonly MusicCatalog $catalog) {}

    /**
     * @param  array{name: string, kind?: ?string, country?: ?string, genre_ids?: list<string>}  $data
     */
    public function handle(array $data): Artist
    {
        $name = trim($data['name']);
        if ($this->catalog->artist($name) !== null) {
            throw ValidationException::withMessages(['name' => 'Este artista ya está en el catálogo.']);
        }

        return DB::transaction(function () use ($name, $data) {
            $artist = Artist::query()->create([
                'name' => $name,
                'slug' => $this->catalog->artistSlug($name),
                'kind' => ArtistKind::tryFrom((string) ($data['kind'] ?? ''))?->value,
                'country' => $data['country'] ?? null,
                'source' => 'manual',
            ]);
            $ids = $data['genre_ids'] ?? [];
            $genres = Genre::query()->whereKey($ids)->get()->sortBy(fn (Genre $genre) => array_search($genre->id, $ids, true))->values();
            $this->catalog->attachGenres($artist, $genres);
            $this->catalog->forget();

            return $artist;
        });
    }
}
