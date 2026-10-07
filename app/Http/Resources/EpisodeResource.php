<?php

namespace App\Http\Resources;

use App\Domain\Storage\MediaStorage;
use App\Models\Episode;
use App\Models\Hashtag;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An episode with its audio, for the studio and for any page that plays it.
 * Eager load "track" and "hashtags" (and "station.frequency" to include the station).
 *
 * @mixin Episode
 */
class EpisodeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $storage = app(MediaStorage::class);

        return [
            'id' => $this->id,
            'uuid' => $this->id,
            'title' => $this->title,
            'program' => $this->program,
            'description' => $this->description,
            'cover_url' => $storage->url($this->cover_path) ?? $storage->url($this->track->cover_path),
            'audio_url' => $storage->url($this->track->file_path),
            'duration' => (float) $this->track->duration,
            'season' => $this->season,
            'number' => $this->number,
            'hashtags' => $this->hashtags->map(fn (Hashtag $tag) => $tag->name)->values()->all(),
            'status' => ['value' => $this->status->value, 'label' => $this->status->label()],
            'aired_on' => $this->aired_on?->toDateString(),
            'publish_at' => $this->publish_at?->toIso8601String(),
            'published_at' => $this->published_at?->toIso8601String(),
            'track' => ['id' => $this->track->id, 'title' => $this->track->title, 'kind' => $this->track->kind->value],
            'station' => $this->whenLoaded('station', fn () => StationResource::make($this->station)->resolve($request)),
        ];
    }
}
