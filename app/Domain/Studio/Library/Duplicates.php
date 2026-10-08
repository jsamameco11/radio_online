<?php

namespace App\Domain\Studio\Library;

use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Enums\TrackKind;
use App\Models\Genre;
use App\Models\Track;
use Illuminate\Database\Eloquent\Collection;

/**
 * Tells whether the songs about to be uploaded are already in the library (or
 * twice in the same upload), with the verdict of SameSong and its reasons, and
 * what the studio needs to compare them: covers and the audio to listen to.
 */
final class Duplicates
{
    /** Songs of one upload read at once; only the ones asked for are judged. */
    public const MAX_SONGS = 600;

    public function __construct(
        private readonly SameSong $judge,
        private readonly MediaStorage $storage,
    ) {}

    /**
     * @param  array<string, array<string, mixed>>  $songs  By the key the browser gave them, in upload order.
     * @param  list<string>|null  $only  Keys of the songs to judge; the others only count as songs before them.
     * @return array<string, list<array<string, mixed>>>
     */
    public function review(array $songs, ?array $only = null): array
    {
        return array_map(
            fn (array $matches) => array_map(fn (array $match) => isset($match['track']) ? [...$match, 'track' => $this->brief($match['track'])] : $match, $matches),
            $this->judge->review($songs, $this->library(), $only),
        );
    }

    /**
     * The song of the library an upload would duplicate, or null.
     *
     * @param  array<string, mixed>  $song  title, artist, featured, album, year, duration and ids.
     */
    public function twin(array $song): ?Track
    {
        return $this->judge->twinIn($song, $this->library());
    }

    /** @return array<string, mixed> */
    public function brief(Track $track): array
    {
        return [
            'id' => $track->id,
            'title' => $track->title,
            'artist' => $track->credit(),
            'album' => $track->album,
            'year' => $track->year,
            'duration' => (float) $track->duration,
            'genres' => $track->genres->map(fn (Genre $genre) => $genre->name)->values()->all(),
            'cover_url' => $this->storage->url($track->cover_path),
            'audio_url' => $this->storage->url($track->file_path),
        ];
    }

    /** @return Collection<int, Track> */
    private function library(): Collection
    {
        return Track::query()
            ->with('genres')
            ->where('kind', TrackKind::Song)
            ->get(['id', 'station_id', 'kind', 'title', 'artist', 'featured', 'album', 'year', 'duration', 'identity', 'cover_path', 'file_path']);
    }
}
