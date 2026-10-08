<?php

namespace App\Http\Resources;

use App\Domain\Storage\MediaStorage;
use App\Models\Category;
use App\Models\Hashtag;
use App\Models\Station;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A station as every screen shows it: "89.30 FM · Radio Aurora" with its
 * artwork, broadcast state, audience, styles, hashtags and current topic.
 *
 * Eager load "frequency", "categories", "hashtags" and "currentTopic.hashtags"
 * before serializing a list, then pass `->resolve()` to Inertia.
 *
 * @mixin Station
 */
class StationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $storage = app(MediaStorage::class);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'display_name' => $this->displayName(),
            'frequency' => [
                'label' => $this->frequency->label,
                'slug' => $this->frequency->slug,
                'band' => $this->frequency->band,
                'display' => $this->frequency->display(),
            ],
            'tagline' => $this->tagline,
            'logo_url' => $storage->url($this->logo_path),
            'cover_url' => $storage->url($this->cover_path),
            'accent_color' => $this->accent_color,
            'status' => $this->status->value,
            'stream_status' => [
                'value' => $this->stream_status->value,
                'label' => $this->stream_status->label(),
                'audible' => $this->stream_status->isAudible(),
            ],
            'listener_count' => $this->listener_count,
            'follower_count' => $this->follower_count,
            'rating_average' => round((float) $this->rating_average, 2),
            'rating_count' => $this->rating_count,
            'categories' => $this->whenLoaded('categories', fn () => $this->categories
                ->map(fn (Category $category) => ['id' => $category->id, 'name' => $category->name, 'slug' => $category->slug])
                ->values()
                ->all()),
            'hashtags' => $this->whenLoaded('hashtags', fn () => $this->hashtags->map(fn (Hashtag $tag) => $tag->name)->values()->all()),
            'current_topic' => $this->whenLoaded('currentTopic', fn () => $this->currentTopic === null ? null : [
                'title' => $this->currentTopic->title,
                'started_at' => $this->currentTopic->started_at->toIso8601String(),
                'hashtags' => $this->currentTopic->relationLoaded('hashtags')
                    ? $this->currentTopic->hashtags->map(fn (Hashtag $tag) => $tag->name)->values()->all()
                    : [],
            ]),
        ];
    }
}
