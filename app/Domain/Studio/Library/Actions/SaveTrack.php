<?php

namespace App\Domain\Studio\Library\Actions;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaFolder;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Catalog\MusicCatalog;
use App\Domain\Studio\Catalog\Names;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\AudioFile;
use App\Domain\Studio\Library\AudioUploads;
use App\Domain\Studio\Library\Identify\CoverDownload;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\Genre;
use App\Models\Track;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Adds an audio to the library or changes one: its file (uploaded straight
 * to storage or with the form), its details, cover and genres. A new file
 * replaces the old one and forgets any edit made to it.
 */
final class SaveTrack
{
    public function __construct(
        private readonly AudioUploads $uploads,
        private readonly MediaStorage $storage,
        private readonly CoverDownload $covers,
        private readonly MusicCatalog $catalog,
        private readonly CurrentStation $current,
        private readonly PlayoutCaches $caches,
    ) {}

    /**
     * @param  array<string, mixed>  $data  Validated by SaveLibraryTrackRequest.
     */
    public function handle(User $user, array $data, ?UploadedFile $audio = null, ?UploadedFile $cover = null, ?Track $track = null): Track
    {
        $track ??= new Track;
        $kind = TrackKind::from($data['kind'] ?? $track->kind?->value);
        $newAudio = ! $track->exists || $audio !== null || ! empty($data['upload']);

        $created = [];
        try {
            $audioKey = $newAudio ? $this->uploads->receive($user, $kind, $data['upload'] ?? null, $data['parts'] ?? null, $audio) : null;
            $created[] = $audioKey;
            $coverKey = $this->cover($data, $cover);
            $created[] = $coverKey;

            $replaced = DB::transaction(function () use ($track, $kind, $data, $audioKey, $coverKey) {
                $replaced = [];
                $song = $kind === TrackKind::Song;
                $track->fill([
                    'kind' => $kind,
                    'title' => trim((string) $data['title']),
                    'artist' => filled($data['artist'] ?? null) ? Names::cleanArtist((string) $data['artist']) : null,
                    'featured' => $song ? (Names::unique($data['featured'] ?? []) ?: null) : null,
                    'album' => $song && filled($data['album'] ?? null) ? trim((string) $data['album']) : null,
                    'year' => $song ? ($data['year'] ?? null) : null,
                ]);
                if (array_key_exists('rotation', $data)) {
                    $track->rotation = $song && (bool) $data['rotation'];
                }
                if (! $track->exists) {
                    $track->duck = $kind->ducksByDefault();
                    $track->rotation = $song && (bool) ($data['rotation'] ?? false);
                }
                if ($audioKey !== null) {
                    $replaced = [$track->file_path, $track->original_path];
                    $this->attachAudio($track, $audioKey, (float) $data['duration']);
                }
                if ($coverKey !== null || ! empty($data['remove_cover'])) {
                    $replaced[] = $track->cover_path;
                    $track->cover_path = $coverKey;
                }
                if (array_key_exists('identity', $data)) {
                    $track->identity = $song ? $data['identity'] : null;
                    $track->identified_at = $song && $data['identity'] ? now() : null;
                }
                $track->save();

                $this->syncGenres($track, $song ? ($data['genre_ids'] ?? []) : []);
                if ($song) {
                    $this->catalog->learn($track, (array) Arr::get($data, 'identity.artist', []));
                }

                return $replaced;
            });
        } catch (Throwable $exception) {
            foreach ($created as $key) {
                $this->storage->delete($key);
            }

            throw $exception;
        }

        foreach (array_filter($replaced) as $key) {
            $this->storage->delete($key);
        }
        $this->caches->flush();

        return $track->load('genres');
    }

    private function attachAudio(Track $track, string $key, float $duration): void
    {
        $extension = pathinfo($key, PATHINFO_EXTENSION);
        $track->forceFill([
            'file_path' => $key,
            'mime' => AudioFile::contentType($extension),
            'size_bytes' => $this->size($key),
            'duration' => round(min($duration, AudioFile::maxDuration()), 2),
            'original_path' => null,
            'original_duration' => null,
            'edit' => null,
            'edit_status' => null,
            'edit_error' => null,
            'edited_at' => null,
            'file_problem' => null,
            'file_problem_at' => null,
            'file_checked_at' => now(),
        ]);
    }

    /** @param  array<string, mixed>  $data */
    private function cover(array $data, ?UploadedFile $cover): ?string
    {
        if ($cover !== null) {
            return $this->storage->store($cover, MediaFolder::Covers, $this->current->id());
        }

        return filled($data['cover_url'] ?? null) ? $this->covers->fetch((string) $data['cover_url']) : null;
    }

    /** @param  list<string>  $ids */
    private function syncGenres(Track $track, array $ids): void
    {
        $known = Genre::query()->whereKey($ids)->pluck('id')->all();
        $ordered = array_values(array_slice(array_intersect(array_unique($ids), $known), 0, Track::MAX_GENRES));
        $track->genres()->sync(collect($ordered)->mapWithKeys(fn (string $id, int $position) => [$id => ['position' => $position]])->all());
    }

    private function size(string $key): ?int
    {
        try {
            return $this->storage->disk($this->storage->folderOf($key))->size($key);
        } catch (Throwable) {
            return null;
        }
    }
}
