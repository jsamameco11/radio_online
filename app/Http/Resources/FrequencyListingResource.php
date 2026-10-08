<?php

namespace App\Http\Resources;

use App\Models\FrequencyListing;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Something on sale as buyers see it: price, pitch, the frequency and, for a
 * station its owner sells, the station itself. Never exposes who sells it
 * nor where they get paid.
 *
 * Eager load "frequency" and "station" with
 * App\Domain\Discovery\Queries\StationDirectory::RELATIONS and its
 * "episodes" and "tracks" counts.
 *
 * @mixin FrequencyListing
 */
class FrequencyListingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $station = $this->by_platform && $this->isActive() ? null : $this->station;

        return [
            'id' => $this->id,
            'by_platform' => $this->by_platform,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'price_cents' => $this->price_cents,
            'currency' => $this->currency,
            'pitch' => $this->pitch,
            'listed_at' => $this->created_at?->toIso8601String(),
            'sold_at' => $this->sold_at?->toIso8601String(),
            'frequency' => [
                'label' => $this->frequency->label,
                'slug' => $this->frequency->slug,
                'band' => $this->frequency->band,
                'display' => $this->frequency->display(),
            ],
            'station' => $station === null ? null : StationResource::make($station)->resolve($request),
            'episode_count' => (int) $station?->episodes_count,
            'track_count' => (int) $station?->tracks_count,
        ];
    }
}
