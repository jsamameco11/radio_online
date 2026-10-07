<?php

namespace App\Http\Resources\Admin;

use App\Domain\Storage\MediaStorage;
use App\Models\Station;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A station in the control panel lists. Eager load "frequency" and "owner".
 *
 * @mixin Station
 */
class StationRowResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'display_name' => $this->displayName(),
            'frequency' => ['label' => $this->frequency->label, 'slug' => $this->frequency->slug, 'band' => $this->frequency->band, 'display' => $this->frequency->display()],
            'logo_url' => app(MediaStorage::class)->url($this->logo_path),
            'accent_color' => $this->accent_color,
            'owner' => ['id' => $this->owner->id, 'name' => $this->owner->name, 'email' => $this->owner->email],
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'stream_status' => ['value' => $this->stream_status->value, 'label' => $this->stream_status->label(), 'audible' => $this->stream_status->isAudible()],
            'listener_count' => $this->listener_count,
            'peak_listener_count' => $this->peak_listener_count,
            'follower_count' => $this->follower_count,
            'last_heartbeat_at' => $this->last_heartbeat_at?->toIso8601String(),
            'suspended_at' => $this->suspended_at?->toIso8601String(),
            'suspension_reason' => $this->suspension_reason,
            'created_at' => $this->created_at->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}
