<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An important action, recorded once and never edited. Written through
 * App\Domain\Audit\AuditTrail.
 */
#[Fillable(['actor_id', 'action', 'subject_type', 'subject_id', 'station_id', 'ip_address', 'user_agent', 'meta', 'created_at'])]
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(Station::class);
    }
}
