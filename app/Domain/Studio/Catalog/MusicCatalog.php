<?php

namespace App\Domain\Studio\Catalog;

use App\Domain\Studio\Enums\TrackKind;
use App\Models\Artist;
use App\Models\Genre;
use App\Models\Track;
use Illuminate\Container\Attributes\Scoped;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * The shared music catalog: loads the starting genres and artists, finds a
 * genre or an artist by any of its names and learns the authors of the songs
 * stations save. Lookups are remembered for the rest of the request or job.
 */
#[Scoped]
final class MusicCatalog
{
    /** @var array<string, Genre>|null */
    private ?array $genres = null;

    /** @var array<string, Artist|null> */
    private array $artists = [];

    /**
     * Adds the starting genres and artists that are missing; never changes what is already there.
     *
     * @return array{genres: int, artists: int}
     */
    public function sync(): array
    {
        $existing = Genre::query()->pluck('slug')->flip();
        $order = 0;
        $rows = [];
        foreach (StarterGenres::all() as $family => $genres) {
            foreach ($genres as [$name, $aliases]) {
                $order += 10;
                $slug = Str::slug($name);
                if ($existing->has($slug)) {
                    continue;
                }
                $rows[] = [
                    'id' => (string) Str::uuid(),
                    'name' => $name,
                    'slug' => $slug,
                    'family' => $family,
                    'aliases' => json_encode($aliases, JSON_UNESCAPED_UNICODE),
                    'sort_order' => $order,
                    'custom' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }
        foreach (array_chunk($rows, 100) as $chunk) {
            Genre::query()->insert($chunk);
        }
        $this->forget();

        $artists = 0;
        foreach (StarterArtists::all() as $entry) {
            [$name, $kind, $country, $genres] = $entry;
            $aliases = $entry[4] ?? [];
            if ($this->artist($name) !== null) {
                continue;
            }
            $artist = Artist::query()->create([
                'name' => $name,
                'slug' => $this->artistSlug($name),
                'aliases' => $aliases ?: null,
                'kind' => $kind->value,
                'country' => $country,
                'source' => 'catalog',
            ]);
            $this->attachGenres($artist, collect($genres)->map(fn (string $genre) => $this->genre($genre))->filter()->values());
            $this->artists[Names::key($name)] = $artist;
            $artists++;
        }

        return ['genres' => count($rows), 'artists' => $artists];
    }

    /** Clears what was read, after the catalog changes. */
    public function forget(): void
    {
        $this->genres = null;
        $this->artists = [];
    }

    /** The genre a name or a music-database tag stands for («progressive pop» → Pop progresivo), or null. */
    public function genre(?string $name): ?Genre
    {
        $key = Names::key($name);
        if ($key === '') {
            return null;
        }
        $genres = $this->genreIndex();
        if (isset($genres[$key])) {
            return $genres[$key];
        }
        $plain = trim((string) preg_replace('/\b(music|musica|genre|genero|style|estilo)\b/', '', $key));

        return $plain !== '' ? $genres[$plain] ?? null : null;
    }

    /**
     * Genres for a list of names, each once and in order.
     *
     * @param  iterable<string>  $names
     * @return Collection<int, Genre>
     */
    public function genres(iterable $names): Collection
    {
        return collect($names)->map(fn (string $name) => $this->genre($name))->filter()->unique('id')->values();
    }

    /** The catalog artist with that name or one of its other spellings, or null. */
    public function artist(?string $name): ?Artist
    {
        $name = trim((string) $name);
        $key = Names::key($name);
        if ($key === '') {
            return null;
        }
        if (! array_key_exists($key, $this->artists)) {
            $this->artists[$key] = Artist::query()->with('genres')->where('slug', Str::slug($name))->first()
                ?? Artist::query()->with('genres')->whereJsonContains('aliases', $name)->first();
        }

        return $this->artists[$key];
    }

    /**
     * Learns the authors of a saved song: unknown names become catalog artists and a main
     * author without genres takes the genres of the song.
     *
     * @param  array{kind?: ?string, country?: ?string, musicbrainz_id?: ?string}  $details  What the internet said of the main author.
     */
    public function learn(Track $track, array $details = []): void
    {
        if ($track->kind !== TrackKind::Song || ! $track->artist) {
            return;
        }
        $genres = $track->genres()->get();
        foreach (Names::unique([$track->artist, ...($track->featured ?? [])]) as $index => $name) {
            $main = $index === 0;
            $artist = $this->artist($name);
            if ($artist === null) {
                $artist = Artist::query()->create([
                    'name' => Str::limit($name, 120, ''),
                    'slug' => $this->artistSlug($name),
                    'kind' => $main ? ArtistKind::tryFrom((string) ($details['kind'] ?? ''))?->value : null,
                    'country' => $main && preg_match('/^[A-Z]{2}$/', (string) ($details['country'] ?? '')) === 1 ? $details['country'] : null,
                    'musicbrainz_id' => $main && Str::isUuid((string) ($details['musicbrainz_id'] ?? '')) ? $details['musicbrainz_id'] : null,
                    'source' => 'learned',
                ]);
                $artist->setRelation('genres', new EloquentCollection);
                $this->artists[Names::key($name)] = $artist;
            }
            if ($main && $genres->isNotEmpty() && $artist->genres->isEmpty()) {
                $this->attachGenres($artist, $genres);
            }
        }
    }

    /** @param  Collection<int, Genre>  $genres */
    public function attachGenres(Artist $artist, Collection $genres): void
    {
        $chosen = $genres->unique('id')->take(Track::MAX_GENRES)->values();
        $artist->genres()->sync($chosen->mapWithKeys(fn (Genre $genre, int $position) => [$genre->id => ['position' => $position]])->all());
        $artist->setRelation('genres', new EloquentCollection($chosen->all()));
    }

    public function artistSlug(string $name): string
    {
        return $this->uniqueSlug(Artist::class, Str::limit(Str::slug($name) ?: 'artista', 130, ''));
    }

    /** @return array<string, Genre> Every name of every genre; a genre's own name wins over another's alias. */
    private function genreIndex(): array
    {
        if ($this->genres === null) {
            $all = Genre::query()->orderBy('sort_order')->get();
            $map = [];
            foreach ($all as $genre) {
                $map[Names::key($genre->name)] ??= $genre;
                $map[Names::key($genre->slug)] ??= $genre;
            }
            foreach ($all as $genre) {
                foreach ($genre->aliases ?? [] as $alias) {
                    $map[Names::key($alias)] ??= $genre;
                }
            }
            $this->genres = $map;
        }

        return $this->genres;
    }

    /** @param  class-string<Artist|Genre>  $model */
    private function uniqueSlug(string $model, string $base): string
    {
        $slug = $base;
        for ($n = 2; $model::query()->where('slug', $slug)->exists(); $n++) {
            $slug = $base.'-'.$n;
        }

        return $slug;
    }
}
