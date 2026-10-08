<?php

namespace App\Http\Resources;

use App\Domain\Storage\MediaStorage;
use App\Models\StationStory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A story as listeners watch it. "seen" comes from StoryFeed::ofStation().
 *
 * @mixin StationStory
 */
class StoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $storage = app(MediaStorage::class);

        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'media_url' => $storage->url($this->media_key),
            'poster_url' => $storage->url($this->poster_key),
            'text' => $this->text,
            'background' => $this->background?->value,
            'duration_ms' => $this->duration_ms,
            'created_at' => $this->created_at->toIso8601String(),
            'expires_at' => $this->expires_at->toIso8601String(),
            'seen' => (bool) ($this->seen ?? false),
        ];
    }
}
