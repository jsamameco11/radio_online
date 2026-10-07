<?php

namespace App\Http\Resources;

use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Enums\RecordingStatus;
use App\Models\Recording;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A console recording as the studio lists it, with a short-lived link to its private file.
 * Eager load "user" and "track".
 *
 * @mixin Recording
 */
class RecordingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $status = RecordingStatus::tryFrom((string) $this->getRawOriginal('status')) ?? RecordingStatus::Recording;
        $ready = $status === RecordingStatus::Ready && $this->path;

        return [
            'id' => $this->id,
            'status' => ['value' => $status->value, 'label' => $status->label()],
            'convertible' => (bool) $ready,
            'deletable' => ! in_array($status, [RecordingStatus::Recording, RecordingStatus::Saving], true),
            'audio_url' => $this->path && $status !== RecordingStatus::Recording ? app(MediaStorage::class)->url($this->path, now()->addMinutes(30)) : null,
            'duration' => $this->duration === null ? null : (float) $this->duration,
            'bytes' => $this->bytes,
            'started_at' => $this->started_at?->toIso8601String(),
            'finished_at' => $this->finished_at?->toIso8601String(),
            'host' => $this->user?->name,
            'track' => $this->track ? ['id' => $this->track->id, 'title' => $this->track->title, 'kind' => $this->track->kind->label()] : null,
        ];
    }
}
