<?php

namespace App\Domain\Studio\Catalog\Actions;

use App\Domain\Studio\Catalog\MusicCatalog;
use App\Domain\Studio\Enums\TrackKind;
use App\Models\Genre;
use App\Models\Track;
use Illuminate\Support\Facades\DB;

/**
 * Gives genres to songs of the current station: added after the ones they
 * already carry or in place of them, or taken from the catalog artist of
 * songs that have none.
 */
final class AssignGenres
{
    public const ADD = 'add';

    public const REPLACE = 'replace';

    public function __construct(private readonly MusicCatalog $catalog) {}

    /**
     * @param  list<string>  $trackIds
     * @param  list<string>  $genreIds
     * @return int Songs changed.
     */
    public function handle(array $trackIds, array $genreIds, string $mode): int
    {
        $genres = Genre::query()->whereKey($genreIds)->get()->sortBy(fn (Genre $genre) => array_search($genre->id, $genreIds, true))->pluck('id')->all();
        $songs = Track::query()->whereKey($trackIds)->where('kind', TrackKind::Song->value)->with('genres')->get();

        DB::transaction(function () use ($songs, $genres, $mode) {
            foreach ($songs as $song) {
                $ids = $mode === self::REPLACE ? $genres : [...$song->genres->pluck('id')->all(), ...$genres];
                $this->sync($song, $ids);
            }
        });

        return $songs->count();
    }

    /** Songs without genres take the genres of their main author, when the catalog knows them. */
    public function classify(): int
    {
        $changed = 0;
        Track::query()->where('kind', TrackKind::Song->value)->whereNotNull('artist')->whereDoesntHave('genres')
            ->chunkById(200, function ($songs) use (&$changed) {
                foreach ($songs as $song) {
                    $genres = $this->catalog->artist($song->artist)?->genres;
                    if ($genres !== null && $genres->isNotEmpty()) {
                        $this->sync($song, $genres->pluck('id')->all());
                        $changed++;
                    }
                }
            });

        return $changed;
    }

    /** @param  list<string>  $ids */
    private function sync(Track $song, array $ids): void
    {
        $ordered = array_slice(array_values(array_unique($ids)), 0, Track::MAX_GENRES);
        $song->genres()->sync(collect($ordered)->mapWithKeys(fn (string $id, int $position) => [$id => ['position' => $position]])->all());
    }
}
