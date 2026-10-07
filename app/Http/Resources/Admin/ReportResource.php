<?php

namespace App\Http\Resources\Admin;

use App\Domain\Gifts\Enums\GiftMessageStatus;
use App\Models\Episode;
use App\Models\GiftMessage;
use App\Models\Report;
use App\Models\Station;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A report in the moderation queue with a summary of the reported content.
 * Eager load "reporter", "resolver" and "reportable" with
 * App\Http\Controllers\Admin\ModerationController::REPORTABLE_RELATIONS.
 *
 * @mixin Report
 */
class ReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reason' => $this->reason->value,
            'reason_label' => $this->reason->label(),
            'details' => $this->details,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'reporter' => $this->reporter === null ? null : ['id' => $this->reporter->id, 'name' => $this->reporter->name],
            'resolver' => $this->resolver === null ? null : ['id' => $this->resolver->id, 'name' => $this->resolver->name],
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolution_note' => $this->resolution_note,
            'target' => $this->target(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function target(): array
    {
        $content = $this->reportable;

        return match (true) {
            $content instanceof Station => [
                'type' => 'station',
                'type_label' => 'Emisora',
                'title' => $content->displayName(),
                'excerpt' => $content->tagline,
                'station' => $this->station($content),
                'hidden' => false,
            ],
            $content instanceof Episode => [
                'type' => 'episode',
                'type_label' => 'Episodio',
                'title' => $content->title,
                'excerpt' => $content->description === null ? null : mb_strimwidth($content->description, 0, 160, '…'),
                'station' => $content->station === null ? null : $this->station($content->station),
                'hidden' => false,
            ],
            $content instanceof GiftMessage => [
                'type' => 'gift_message',
                'type_label' => 'Mensaje de regalo',
                'title' => 'Mensaje de '.$content->giftTransaction->sender->name,
                'excerpt' => $content->body ?? ($content->voice_path ? 'Nota de voz' : null),
                'station' => $content->giftTransaction->station === null ? null : $this->station($content->giftTransaction->station),
                'hidden' => $content->status === GiftMessageStatus::Hidden,
            ],
            default => [
                'type' => $this->reportable_type,
                'type_label' => 'Contenido',
                'title' => 'Contenido eliminado',
                'excerpt' => null,
                'station' => null,
                'hidden' => false,
            ],
        };
    }

    /**
     * @return array{id: int, display_name: string, status: string}
     */
    private function station(Station $station): array
    {
        return ['id' => $station->id, 'display_name' => $station->displayName(), 'status' => $station->status->value];
    }
}
