<?php

namespace App\Models;

use App\Domain\Integrity\Enums\AlertKind;
use App\Domain\Integrity\Enums\AlertSeverity;
use App\Domain\Integrity\Enums\AlertStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A pattern of fake audience the scanner found on a station (see IntegrityScanner). The
 * evidence keeps the figures and, for subscription alerts, the accounts involved
 * ("user_ids"); for audience alerts, the hashed networks ("networks").
 */
#[Fillable(['station_id', 'kind', 'severity', 'status', 'evidence', 'detected_at', 'last_detected_at', 'resolved_by', 'resolved_at', 'note'])]
class IntegrityAlert extends Model
{
    protected $attributes = [
        'status' => 'open',
    ];

    protected function casts(): array
    {
        return [
            'kind' => AlertKind::class,
            'severity' => AlertSeverity::class,
            'status' => AlertStatus::class,
            'evidence' => 'array',
            'detected_at' => 'datetime',
            'last_detected_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(Station::class)->withTrashed();
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function isOpen(): bool
    {
        return $this->status === AlertStatus::Open;
    }

    /** @return list<int> */
    public function userIds(): array
    {
        return array_values(array_map('intval', (array) ($this->evidence['user_ids'] ?? [])));
    }

    /** @return list<string> */
    public function networks(): array
    {
        return array_values(array_map('strval', (array) ($this->evidence['networks'] ?? [])));
    }
}
