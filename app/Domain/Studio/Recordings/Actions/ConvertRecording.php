<?php

namespace App\Domain\Studio\Recordings\Actions;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Studio\Enums\RecordingStatus;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\AudioFile;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\Episode;
use App\Models\Recording;
use App\Models\Track;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Turns a finished console recording into a library audio (and, optionally,
 * a draft episode): the private file is copied to the public folder of its
 * kind and the recording is marked as saved.
 */
final class ConvertRecording
{
    public function __construct(
        private readonly MediaStorage $storage,
        private readonly CurrentStation $current,
        private readonly PlayoutCaches $caches,
    ) {}

    /**
     * @param  array{title: string, kind: string, episode?: bool, program?: ?string, description?: ?string}  $data
     */
    public function handle(Recording $recording, array $data): Track
    {
        if ($recording->getRawOriginal('status') !== RecordingStatus::Ready->value || ! $this->storage->exists($recording->path)) {
            throw ValidationException::withMessages(['recording' => 'Esta grabación ya no se puede guardar.']);
        }
        $kind = TrackKind::from($data['kind']);
        $source = $this->storage->disk($this->storage->folderOf((string) $recording->path));
        $stream = $source->readStream((string) $recording->path);
        try {
            $key = $this->storage->put($stream, AudioFile::folder($kind), $recording->extension ?: 'webm', $this->current->id());
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        try {
            $track = DB::transaction(function () use ($recording, $data, $kind, $key) {
                $track = Track::query()->create([
                    'kind' => $kind,
                    'title' => trim($data['title']),
                    'file_path' => $key,
                    'mime' => $recording->mime,
                    'size_bytes' => $recording->bytes ?: null,
                    'duration' => max(0.5, (float) $recording->duration),
                    'duck' => $kind->ducksByDefault(),
                ]);
                if (! empty($data['episode'])) {
                    Episode::query()->create([
                        'track_id' => $track->id,
                        'title' => trim($data['title']),
                        'program' => $data['program'] ?? null,
                        'description' => $data['description'] ?? null,
                        'status' => EpisodeStatus::Draft,
                        'aired_on' => ($recording->started_at ?? now())->toDateString(),
                    ]);
                }
                $recording->update(['status' => RecordingStatus::Saved->value, 'track_id' => $track->id]);

                return $track;
            });
        } catch (Throwable $exception) {
            $this->storage->delete($key);

            throw $exception;
        }
        $this->caches->flush();

        return $track;
    }
}
