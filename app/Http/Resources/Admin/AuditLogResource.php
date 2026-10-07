<?php

namespace App\Http\Resources\Admin;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One line of the audit log. Eager load "actor" and "station.frequency".
 *
 * @mixin AuditLog
 */
class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'actor' => $this->actor === null ? null : ['id' => $this->actor->id, 'name' => $this->actor->name, 'email' => $this->actor->email],
            'subject' => $this->subject_type === null ? null : ['type' => $this->subject_type, 'id' => $this->subject_id],
            'station' => $this->station === null ? null : [
                'id' => $this->station->id,
                'name' => $this->station->name,
                'frequency' => $this->station->frequency->label,
            ],
            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'meta' => $this->meta,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
