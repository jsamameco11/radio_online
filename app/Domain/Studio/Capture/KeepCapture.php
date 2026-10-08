<?php

namespace App\Domain\Studio\Capture;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaFolder;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Studio\Episodes\Actions\SaveEpisode;
use App\Domain\Studio\Recordings\Actions\ConvertRecording;
use App\Models\Episode;
use App\Models\Recording;
use App\Models\Track;
use Illuminate\Http\UploadedFile;
use Throwable;

/**
 * Keeps the recording of a console transmission when it ends: a library audio and, optionally,
 * its episode, with a cover and published right away («Publicar en Episodios») or as a draft.
 */
final class KeepCapture
{
    public function __construct(
        private readonly ConvertRecording $convert,
        private readonly MediaStorage $storage,
        private readonly CurrentStation $current,
    ) {}

    /**
     * @param  array{title: string, kind: string, episode?: bool, program?: ?string, description?: ?string, publish?: bool}  $data
     * @return array{track: Track, episode: ?Episode}
     */
    public function handle(Recording $recording, array $data, ?UploadedFile $cover): array
    {
        $track = $this->convert->handle($recording, $data);
        if (empty($data['episode'])) {
            return ['track' => $track, 'episode' => null];
        }

        $episode = Episode::query()->where('track_id', $track->id)->latest()->firstOrFail();
        $key = $cover ? $this->storage->store($cover, MediaFolder::Covers, $this->current->id()) : null;
        try {
            if ($key !== null) {
                $episode->cover_path = $key;
            }
            if (! empty($data['publish'])) {
                SaveEpisode::applyStatus($episode, EpisodeStatus::Published, null);
            }
            $episode->save();
        } catch (Throwable $exception) {
            $this->storage->delete($key);

            throw $exception;
        }

        return ['track' => $track, 'episode' => $episode];
    }
}
