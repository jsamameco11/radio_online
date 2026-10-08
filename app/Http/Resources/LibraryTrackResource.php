<?php

namespace App\Http\Resources;

use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Enums\EpisodeStatus;
use App\Domain\Studio\Library\FileProblem;
use App\Models\Genre;
use App\Models\Track;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An audio of the station library as the studio shows it. Eager load "genres"
 * and the counts of LibraryTrackResource::counts().
 *
 * @mixin Track
 */
class LibraryTrackResource extends JsonResource
{
    /**
     * Upcoming schedule blocks that play the audio and published episodes made from it.
     *
     * @return array<string, \Closure(Builder): Builder>
     */
    public static function counts(): array
    {
        return [
            'slots as upcoming_count' => fn (Builder $query) => $query->where('starts_at', '>=', now()),
            'episodes as published_episodes_count' => fn (Builder $query) => $query->where('status', EpisodeStatus::Published),
        ];
    }

    public function toArray(Request $request): array
    {
        $storage = app(MediaStorage::class);
        $problem = FileProblem::tryFrom((string) $this->file_problem);

        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'kind_label' => $this->kind->label(),
            'title' => $this->title,
            'artist' => $this->artist,
            'featured' => $this->featured ?? [],
            'credit' => $this->credit(),
            'album' => $this->album,
            'year' => $this->year,
            'duration' => (float) $this->duration,
            'size_bytes' => $this->size_bytes,
            'audio_url' => $storage->url($this->file_path),
            'cover_url' => $storage->url($this->cover_path),
            'rotation' => $this->rotation,
            'duck' => $this->duck,
            'active' => $this->active,
            'genres' => $this->genres->map(fn (Genre $genre) => $genre->brief())->values()->all(),
            'confidence' => $this->identity['confidence'] ?? null,
            'identity' => $this->identity ? [
                'confidence' => $this->identity['confidence'] ?? null,
                'sources' => $this->identity['sources'] ?? [],
                'guessed' => $this->identity['guessed'] ?? [],
            ] : null,
            'upcoming' => (int) $this->upcoming_count,
            'episodes_count' => (int) $this->published_episodes_count,
            'edited' => $this->original_path !== null,
            'edit_status' => $this->edit_status,
            'problem' => $problem ? ['value' => $problem->value, 'label' => $problem->label()] : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
