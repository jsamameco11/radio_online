<?php

namespace App\Http\Resources\Site;

use App\Models\FrequencyRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A frequency request as its applicant follows it. Eager load "frequency".
 *
 * @mixin FrequencyRequest
 */
class FrequencyRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'station_name' => $this->station_name,
            'frequency' => [
                'label' => $this->frequency->label,
                'slug' => $this->frequency->slug,
                'display' => $this->frequency->display(),
            ],
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'review_note' => $this->review_note,
            'created_at' => $this->created_at->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
        ];
    }
}
