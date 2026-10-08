<?php

namespace App\Http\Resources;

use App\Domain\Storage\MediaStorage;
use App\Models\Track;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A library audio as the console and the schedule need it: enough to fire it, place it or
 * preview it.
 *
 * @mixin Track
 */
class BroadcastTrackResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $storage = app(MediaStorage::class);

        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'kind_label' => $this->kind->label(),
            'title' => $this->title,
            'artist' => $this->credit(),
            'duration' => (float) $this->duration,
            'duck' => $this->duck,
            'rotation' => (bool) $this->rotation,
            'src' => $storage->url($this->file_path),
            'cover_url' => $storage->url($this->cover_path),
            'playable' => $this->active && $this->file_problem === null,
        ];
    }
}
