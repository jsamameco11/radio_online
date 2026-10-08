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
 * replaces the old one and forgets any edit made to it. With "replace_audio"
 * an upload takes the place of the file of a song already in the library: the
 * song keeps its details and only takes from the upload what it was missing.
 * Upcoming schedule blocks follow the name, kind and length of their audio.
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
     * @param  array<string, mixed>  $data  Validated by LibraryTrackRequest.
     */
    public function handle(User $user, array $data, ?UploadedFile $audio = null, ?UploadedFile $cover = null, ?Track $track = null): Track
    {
        $track ??= new Track;
        $existed = $track->exists;
        $replacing = $existed && ! empty($data['replace_audio']);
        $kind = $replacing ? $track->kind : TrackKind::from($data['kind'] ?? $track->kind?->value);
        $newAudio = ! $existed || $replacing || $audio !== null || ! empty($data['upload']);

        $created = [];
        try {
            $audioKey = $newAudio ? $this->uploads->receive($user, $kind, $data['upload'] ?? null, $data['parts'] ?? null, $audio) : null;
            $created[] = $audioKey;
            $coverKey = $replacing && $track->cover_path ? null : $this->cover($data, $cover);
            $created[] = $coverKey;

            $replaced = DB::transaction(function () use ($track, $kind, $data, $audioKey, $coverKey, $existed, $replacing) {
                $replaced = [];
                $song = $kind === TrackKind::Song;
                $replacing ? $this->completeMissing($track, $data, $song) : $this->fillDetails($track, $kind, $data, $song);
                if ($audioKey !== null) {
                    $replaced = [$track->file_path, $track->original_path];
                    $this->attachAudio($track, $audioKey, (float) $data['duration']);
                }
                if ($coverKey !== null || (! $replacing && ! empty($data['remove_cover']))) {
                    $replaced[] = $track->cover_path;
                    $track->cover_path = $coverKey;
                }
                $track->save();

                if (! $replacing || ($song && $track->genres()->doesntExist())) {
                    $this->syncGenres($track, $song ? ($data['genre_ids'] ?? []) : []);
                }
                if ($song && ! $replacing) {
                    $this->catalog->learn($track, (array) Arr::get($data, 'identity.artist', []));
                }
                if ($existed) {
                    $track->slots()->where('starts_at', '>=', now())->update([
                        'title' => $track->title,
                        'kind' => $track->kind->value,
                        ...($audioKey !== null ? ['duration' => $track->duration] : []),
                    ]);
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

    /** @param  array<string, mixed>  $data */
    private function fillDetails(Track $track, TrackKind $kind, array $data, bool $song): void
    {
        $track->fill([
            'kind' => $kind,
            'title' => trim((string) $data['title']),
            'artist' => filled($data['artist'] ?? null) ? Names::cleanArtist((string) $data['artist']) : null,
            'featured' => $song ? (Names::unique($data['featured'] ?? []) ?: null) : null,
            'album' => $song && filled($data['album'] ?? null) ? trim((string) $data['album']) : null,
            'year' => $song ? ($data['year'] ?? null) : null,
        ]);
        if (! $track->exists) {
            $track->duck = $kind->ducksByDefault();
            $track->active = true;
            $track->rotation = false;
        }
        if (array_key_exists('duck', $data)) {
            $track->duck = (bool) $data['duck'];
        }
        if (array_key_exists('active', $data)) {
            $track->active = (bool) $data['active'];
        }
        if (array_key_exists('rotation', $data)) {
            $track->rotation = (bool) $data['rotation'];
        }
        $track->rotation = $song && $track->active && $track->rotation;
        if (array_key_exists('identity', $data)) {
            $track->identity = $song ? $data['identity'] : null;
            $track->identified_at = $song && $data['identity'] ? now() : null;
        }
    }

    /**
     * What a song kept by "replace_audio" takes from the upload: only what it did not have.
     *
     * @param  array<string, mixed>  $data
     */
    private function completeMissing(Track $track, array $data, bool $song): void
    {
        if (! $song) {
            return;
        }
        if (! $track->featured && ($featured = Names::unique($data['featured'] ?? []))) {
            $track->featured = $featured;
        }
        if (! $track->album && filled($data['album'] ?? null)) {
            $track->album = trim((string) $data['album']);
        }
        if (! $track->year && ! empty($data['year'])) {
            $track->year = (int) $data['year'];
        }
        if (! $track->identity && ! empty($data['identity'])) {
            $track->identity = $data['identity'];
            $track->identified_at = now();
        }
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
