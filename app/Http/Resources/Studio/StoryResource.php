<?php

namespace App\Http\Resources\Studio;

use App\Http\Resources\StoryResource as PublicStoryResource;
use App\Models\StationStory;
use Illuminate\Http\Request;

/**
 * A story as its station manages it: what listeners see plus its views and who posted it.
 * Eager load "author".
 *
 * @mixin StationStory
 */
class StoryResource extends PublicStoryResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'seen' => true,
            'views_count' => $this->views_count,
            'posted_by' => $this->author?->name,
        ];
    }
}
