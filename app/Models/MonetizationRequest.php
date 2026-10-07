<?php

namespace App\Models;

use App\Domain\Monetization\Enums\MonetizationRequestStatus;
use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A station asking to become a "Radio monetizada", with the figures that made
 * it eligible frozen in the snapshot at request time.
 */
#[Fillable(['station_id', 'requested_by', 'status', 'subscribers', 'snapshot', 'reviewed_by', 'reviewed_at', 'review_note'])]
class MonetizationRequest extends Model
{
    use BelongsToStation;

    protected $attributes = [
        'status' => 'pending',
    ];

    protected function casts(): array
    {
        return [
            'status' => MonetizationRequestStatus::class,
            'subscribers' => 'integer',
            'snapshot' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
