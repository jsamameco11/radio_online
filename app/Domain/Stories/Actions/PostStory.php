<?php

namespace App\Domain\Stories\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaFolder;
use App\Domain\Storage\MediaStorage;
use App\Domain\Stories\Enums\StoryBackground;
use App\Domain\Stories\Enums\StoryKind;
use App\Domain\Stories\Support\StoryLimits;
use App\Domain\Stories\Support\VideoProbe;
use App\Models\Station;
use App\Models\StationStory;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * The current station shares a photo, a video or a text for the next 24 hours.
 * A video lasts what ffprobe measures; without ffprobe the length the browser
 * read is trusted, capped at the maximum.
 */
final class PostStory
{
    public function __construct(
        private readonly MediaStorage $storage,
        private readonly CurrentStation $current,
        private readonly VideoProbe $probe,
        private readonly AuditTrail $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $data  Validated by StoryRequest.
     */
    public function handle(User $user, array $data, ?UploadedFile $media = null, ?UploadedFile $poster = null): StationStory
    {
        $kind = StoryKind::from($data['kind']);
        $text = filled($data['text'] ?? null) ? trim((string) $data['text']) : null;
        $this->ensureRoom();
        if ($kind->hasMedia() && $media === null) {
            throw ValidationException::withMessages(['media' => 'Elige la foto o el video del estado.']);
        }

        $duration = match ($kind) {
            StoryKind::Image => StoryLimits::IMAGE_MS,
            StoryKind::Text => StoryLimits::textDuration((string) $text),
            StoryKind::Video => $this->videoDuration($media, (float) ($data['duration'] ?? 0)),
        };

        $mediaKey = $kind->hasMedia() ? $this->storage->store($media, MediaFolder::Stories, $this->current->id()) : null;
        $posterKey = $kind === StoryKind::Video && $poster !== null ? $this->storage->store($poster, MediaFolder::Stories, $this->current->id()) : null;

        try {
            $story = DB::transaction(function () use ($user, $kind, $text, $data, $duration, $mediaKey, $posterKey) {
                Station::query()->whereKey($this->current->id())->lockForUpdate()->first();
                $this->ensureRoom();

                return StationStory::query()->create([
                    'posted_by' => $user->id,
                    'kind' => $kind,
                    'media_key' => $mediaKey,
                    'poster_key' => $posterKey,
                    'text' => $text,
                    'background' => $kind === StoryKind::Text ? StoryBackground::from($data['background']) : null,
                    'duration_ms' => $duration,
                    'expires_at' => now()->addHours(StoryLimits::lifetimeHours()),
                ]);
            });
        } catch (Throwable $exception) {
            $this->storage->delete($mediaKey);
            $this->storage->delete($posterKey);

            throw $exception;
        }

        $this->audit->record('stories.posted', $story, ['kind' => $kind->value]);

        return $story;
    }

    private function ensureRoom(): void
    {
        $max = StoryLimits::maxActive();
        if (StationStory::query()->active()->count() >= $max) {
            throw ValidationException::withMessages([
                'kind' => "Tu radio ya tiene {$max} estados activos. Elimina alguno o espera a que venzan para publicar otro.",
            ]);
        }
    }

    /** Milliseconds the video plays, at most the configured maximum. */
    private function videoDuration(?UploadedFile $video, float $claimed): int
    {
        $max = StoryLimits::maxVideoSeconds();
        $seconds = $claimed;
        if ($video !== null && $this->probe->available()) {
            $seconds = $this->probe->seconds((string) $video->getRealPath())
                ?? throw ValidationException::withMessages(['media' => 'No pudimos leer el video. Revisa que el archivo no esté dañado.']);
            if ($seconds > $max + 0.5) {
                throw ValidationException::withMessages(['media' => "El video puede durar como máximo {$max} segundos."]);
            }
        }

        return (int) round(max(1, min($seconds, $max)) * 1000);
    }
}
