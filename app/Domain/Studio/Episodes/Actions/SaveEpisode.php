<?php

namespace App\Domain\Studio\Episodes\Actions;

use App\Domain\Discovery\Hashtags;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaFolder;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\Actions\SaveTrack;
use App\Domain\Studio\Recordings\Actions\ConvertRecording;
use App\Models\Episode;
use App\Models\Recording;
use App\Models\Track;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Creates or changes an episode listeners can play on demand. Its audio is a
 * library audio: one uploaded (or recorded in the browser) right here, one
 * already in the library, or a console recording kept for it.
 */
final class SaveEpisode
{
    public const UPLOAD = 'upload';

    public const LIBRARY = 'library';

    public const RECORDING = 'recording';

    public function __construct(
        private readonly SaveTrack $saveTrack,
        private readonly ConvertRecording $convert,
        private readonly MediaStorage $storage,
        private readonly CurrentStation $current,
    ) {}

    /**
     * @param  array<string, mixed>  $data  Validated by EpisodeRequest.
     */
    public function handle(User $user, array $data, ?UploadedFile $audio = null, ?UploadedFile $cover = null, ?Episode $episode = null): Episode
    {
        $episode ??= new Episode;
        $track = $this->audio($user, $data, $audio, $episode);
        $coverKey = $cover ? $this->storage->store($cover, MediaFolder::Covers, $this->current->id()) : null;
        $oldCover = $coverKey !== null || ! empty($data['remove_cover']) ? $episode->cover_path : null;

        try {
            DB::transaction(function () use ($episode, $data, $track, $coverKey) {
                $episode->fill([
                    'title' => trim((string) $data['title']),
                    'program' => filled($data['program'] ?? null) ? trim((string) $data['program']) : null,
                    'description' => filled($data['description'] ?? null) ? trim((string) $data['description']) : null,
                    'season' => $data['season'] ?? null,
                    'number' => $data['number'] ?? null,
                    'aired_on' => $data['aired_on'] ?? ($episode->aired_on ?? now()->toDateString()),
                ]);
                if ($track !== null) {
                    $episode->track_id = $track->id;
                }
                if ($coverKey !== null || ! empty($data['remove_cover'])) {
                    $episode->cover_path = $coverKey;
                }
                self::applyStatus($episode, EpisodeStatus::from($data['status']), isset($data['publish_at']) ? Carbon::parse($data['publish_at']) : null);
                $episode->save();
                Hashtags::sync($episode->hashtags(), $data['hashtags'] ?? [], (int) config('platform.media.max_episode_hashtags'));
            });
        } catch (Throwable $exception) {
            $this->storage->delete($coverKey);

            throw $exception;
        }
        $this->storage->delete($oldCover);

        return $episode->load(['track', 'hashtags']);
    }

    /** Draft, scheduled for a moment, published now or archived. */
    public static function applyStatus(Episode $episode, EpisodeStatus $status, ?Carbon $publishAt): void
    {
        $episode->status = $status;
        match ($status) {
            EpisodeStatus::Draft => $episode->forceFill(['publish_at' => null, 'published_at' => null]),
            EpisodeStatus::Scheduled => $episode->forceFill(['publish_at' => $publishAt, 'published_at' => null]),
            EpisodeStatus::Published => $episode->forceFill(['publish_at' => null, 'published_at' => $episode->published_at ?? now()]),
            EpisodeStatus::Archived => $episode,
        };
    }

    /**
     * The library audio of the episode, or null to keep the one it has.
     *
     * @param  array<string, mixed>  $data
     */
    private function audio(User $user, array $data, ?UploadedFile $audio, Episode $episode): ?Track
    {
        $source = $data['source'] ?? null;
        if ($source === null && $episode->exists) {
            return null;
        }

        return match ($source) {
            self::UPLOAD => $this->saveTrack->handle($user, [
                'kind' => TrackKind::Program->value,
                'title' => $data['title'],
                'duration' => $data['duration'] ?? null,
                'upload' => $data['upload'] ?? null,
                'parts' => $data['parts'] ?? null,
            ], $audio),
            self::LIBRARY => Track::query()->findOrFail($data['track_id']),
            self::RECORDING => $this->convert->handle(Recording::query()->findOrFail($data['recording_id']), [
                'title' => $data['title'],
                'kind' => TrackKind::Program->value,
            ]),
            default => throw ValidationException::withMessages(['source' => 'Elige el audio del episodio.']),
        };
    }
}
