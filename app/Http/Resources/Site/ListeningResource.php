<?php

namespace App\Http\Resources\Site;

use App\Http\Resources\StationResource;
use App\Models\ListenerSession;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One entry of a listener's history. Eager load "station.frequency".
 *
 * @mixin ListenerSession
 */
class ListeningResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'started_at' => $this->started_at->toIso8601String(),
            'ended_at' => $this->ended_at?->toIso8601String(),
            'seconds' => $this->seconds,
            'station' => StationResource::make($this->station)->resolve($request),
        ];
    }
}
