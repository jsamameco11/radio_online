<?php

namespace App\Http\Resources\Stations;

use App\Models\CurrentTopic;
use App\Models\Hashtag;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A topic of the "what is happening now" history. Eager load "hashtags" and "author".
 *
 * @mixin CurrentTopic
 */
class TopicResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'hashtags' => $this->hashtags->map(fn (Hashtag $tag) => $tag->name)->values()->all(),
            'author' => $this->author?->name,
            'started_at' => $this->started_at->toIso8601String(),
            'ended_at' => $this->ended_at?->toIso8601String(),
        ];
    }
}
