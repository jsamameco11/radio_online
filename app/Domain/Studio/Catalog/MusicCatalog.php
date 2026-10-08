<?php

namespace App\Domain\Studio\Catalog;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\Identify\Text;
use App\Models\Artist;
use App\Models\Genre;
use App\Models\Track;
use Illuminate\Container\Attributes\Scoped;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * The shared music catalog: loads the starting genres and artists, finds a
 * genre or an artist by any of its names (an artist also written without
 * spaces, or at the edge of a song name) and learns the authors of the songs
 * stations save. What was read is remembered for the rest of the request or job.
 */
#[Scoped]
final class MusicCatalog
{
    /** Words that only qualify a genre name: «salsa music», «género salsa». */
    private const QUALIFIERS = '/\b(music|musica|musique|musik|genre|genero|style|estilo|songs|canciones)\b/';

    /** Shortest artist name, without spaces, recognized when written joined («MarcAnthony»). */
    private const COMPACT_LENGTH = 6;

    /** @var array<string, Genre>|null */
    private ?array $genres = null;

    /** @var array<string, Artist>|null */
    private ?array $artists = null;

    /** @var array<string, Artist>|null */
    private ?array $compact = null;

    public function __construct(private readonly CurrentStation $current) {}

    /**
     * Adds the starting genres and artists that are missing and keeps the names of the starting
     * genres up to date; never touches the genres and artists stations added or changed.
     *
     * @return array{genres: int, artists: int}
     */
    public function sync(): array
    {
        $owners = [];
        foreach (StarterGenres::all() as $genres) {
            foreach ($genres as [$name, $aliases]) {
                foreach ([$name, ...$aliases] as $alias) {
                    $owners[Text::key($alias)] = Str::slug($name);
                }
            }
        }
        $existing = Genre::query()->get()->keyBy('slug');
        $order = 0;
        $rows = [];
        foreach (StarterGenres::all() as $family => $genres) {
            foreach ($genres as [$name, $aliases]) {
                $order += 10;
                $slug = Str::slug($name);
                $genre = $existing->get($slug);
                if ($genre === null) {
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

                    continue;
                }
                if ($genre->custom) {
                    continue;
                }
                $kept = array_filter($genre->aliases ?? [], fn (string $alias) => ($owners[Text::key($alias)] ?? $slug) === $slug);
                $merged = Text::unique([...$kept, ...$aliases]);
                if ($merged !== ($genre->aliases ?? []) || $genre->sort_order !== $order) {
                    $genre->update(['aliases' => $merged, 'sort_order' => $order]);
                }
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
            if (collect([$name, ...$aliases])->contains(fn (string $known) => $this->artist($known) !== null)) {
                continue;
            }
            $artist = Artist::query()->create([
                'name' => $name,
                'slug' => $this->artistSlug($name),
                'aliases' => $aliases ?: null,
                'kind' => $kind->value,
                'country' => $country,
                'source' => Artist::CATALOG,
            ]);
            $this->attachGenres($artist, $this->genres($genres));
            $this->remember($artist);
            $artists++;
        }

        return ['genres' => count($rows), 'artists' => $artists];
    }

    /** Clears what was read, after the catalog changes. */
    public function forget(): void
    {
        $this->genres = null;
        $this->artists = null;
        $this->compact = null;
    }

    /** The genre a name or a music-database tag stands for («progressive pop» → Pop progresivo), or null. */
    public function genre(?string $name): ?Genre
    {
        $key = Text::key($name);
        if ($key === '') {
            return null;
        }
        $genres = $this->genreIndex();
        if (isset($genres[$key])) {
            return $genres[$key];
        }
        $plain = trim((string) preg_replace('/\s+/', ' ', (string) preg_replace(self::QUALIFIERS, '', $key)));

        return $plain !== '' && $plain !== $key ? $genres[$plain] ?? null : null;
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

    /** The genre with that name, added to the catalog as a custom genre of no station when it does not have it. */
    public function genreFor(string $name, GenreFamily $family = GenreFamily::World): Genre
    {
        $name = Str::limit(trim((string) preg_replace('/\s+/u', ' ', $name)), 60, '');
        $genre = $this->genre($name);
        if ($genre !== null) {
            return $genre;
        }
        $genre = Genre::query()->create([
            'name' => Str::ucfirst($name),
            'slug' => $this->genreSlug($name),
            'family' => $family->value,
            'aliases' => null,
            'sort_order' => $this->nextGenreOrder(),
            'custom' => true,
        ]);
        $this->genres = null;

        return $genre;
    }

    /** The catalog artist with that name or one of its other spellings, also written without spaces («MarcAnthony»), with its genres. */
    public function artist(?string $name): ?Artist
    {
        $key = Text::key($name);
        if ($key === '') {
            return null;
        }
        $compact = str_replace(' ', '', $key);
        $artist = $this->artistIndex()[$key] ?? (strlen($compact) >= self::COMPACT_LENGTH ? $this->compactIndex()[$compact] ?? null : null);

        return $artist?->loadMissing('genres');
    }

    /**
     * The catalog artist a song name starts or ends with, and the rest of the name:
     * «Juanes La Camisa Negra» → [Juanes, «La Camisa Negra»]. The longest name wins.
     *
     * @return array{0: Artist, 1: string}|null
     */
    public function artistAtEdge(string $title): ?array
    {
        $text = Text::key($title);
        $keys = array_filter(array_keys($this->artistIndex()), fn (string $key) => strlen($key) >= 3
            && (str_starts_with($text, $key.' ') || str_ends_with($text, ' '.$key)));
        usort($keys, fn (string $a, string $b) => strlen($b) <=> strlen($a));
        foreach ($keys as $key) {
            $rest = Text::withoutName($title, $key);
            if ($rest !== null) {
                return [$this->artistIndex()[$key]->loadMissing('genres'), $rest];
            }
        }

        return null;
    }

    /**
     * Known names that contain a separator («Wisin & Yandel», «Earth, Wind & Fire»), so credits are not split inside them.
     *
     * @return list<string>
     */
    public function joinedNames(): array
    {
        return collect($this->artistIndex())
            ->unique(fn (Artist $artist) => $artist->id)
            ->flatMap(fn (Artist $artist) => $artist->names())
            ->filter(fn (string $name) => preg_match('/,|\s(&|\+|y|e|x|and|con|with)\s/iu', $name) === 1)
            ->unique()->values()->all();
    }

    /**
     * Learns the authors of a saved song: unknown names become catalog artists of the current
     * station and a main author without genres takes the genres of the song.
     *
     * @param  array{kind?: ?string, country?: ?string, musicbrainz_id?: ?string}  $details  What the internet said of the main author.
     */
    public function learn(Track $track, array $details = []): void
    {
        if ($track->kind !== TrackKind::Song || ! $track->artist) {
            return;
        }
        $genres = $track->genres()->get();
        foreach (Text::unique([$track->artist, ...($track->featured ?? [])]) as $index => $name) {
            $main = $index === 0;
            $artist = $this->artist($name);
            if ($artist === null) {
                $artist = Artist::query()->create([
                    'station_id' => $this->current->id(),
                    'name' => Str::limit($name, 120, ''),
                    'slug' => $this->artistSlug($name),
                    'kind' => $main ? ArtistKind::tryFrom((string) ($details['kind'] ?? ''))?->value : null,
                    'country' => $main && preg_match('/^[A-Z]{2}$/', (string) ($details['country'] ?? '')) === 1 ? $details['country'] : null,
                    'musicbrainz_id' => $main && Str::isUuid((string) ($details['musicbrainz_id'] ?? '')) ? $details['musicbrainz_id'] : null,
                    'source' => Artist::LEARNED,
                ]);
                $artist->setRelation('genres', new EloquentCollection);
                $this->remember($artist);
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

    public function genreSlug(string $name): string
    {
        return $this->uniqueSlug(Genre::class, Str::limit(Str::slug($name) ?: 'genero', 70, ''));
    }

    /** Where a new genre goes: after every other one. */
    public function nextGenreOrder(): int
    {
        return (int) Genre::query()->max('sort_order') + 10;
    }

    /** @return array<string, Genre> Every name of every genre; a genre's own name wins over another's alias. */
    private function genreIndex(): array
    {
        if ($this->genres === null) {
            $all = Genre::query()->orderBy('sort_order')->get();
            $map = [];
            foreach ($all as $genre) {
                $map[Text::key($genre->name)] ??= $genre;
                $map[Text::key($genre->slug)] ??= $genre;
            }
            foreach ($all as $genre) {
                foreach ($genre->aliases ?? [] as $alias) {
                    $map[Text::key($alias)] ??= $genre;
                }
            }
            $this->genres = $map;
        }

        return $this->genres;
    }

    /** @return array<string, Artist> Every name of every artist; an artist's own name wins over another's alias. */
    private function artistIndex(): array
    {
        if ($this->artists === null) {
            $all = Artist::query()->orderBy('created_at')->get();
            $this->artists = [];
            foreach ($all as $artist) {
                $this->artists[Text::key($artist->name)] ??= $artist;
            }
            foreach ($all as $artist) {
                foreach ($artist->aliases ?? [] as $alias) {
                    $this->artists[Text::key($alias)] ??= $artist;
                }
            }
            unset($this->artists['']);
        }

        return $this->artists;
    }

    /** @return array<string, Artist> Every name of every artist without spaces. */
    private function compactIndex(): array
    {
        if ($this->compact === null) {
            $this->compact = [];
            foreach ($this->artistIndex() as $key => $artist) {
                $this->compact[str_replace(' ', '', (string) $key)] ??= $artist;
            }
        }

        return $this->compact;
    }

    private function remember(Artist $artist): void
    {
        if ($this->artists === null) {
            return;
        }
        foreach ($artist->names() as $name) {
            $key = Text::key($name);
            if ($key !== '') {
                $this->artists[$key] ??= $artist;
            }
        }
        $this->compact = null;
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
