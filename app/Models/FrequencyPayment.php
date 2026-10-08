<?php

namespace App\Models;

use App\Domain\Frequencies\Enums\FrequencyPaymentStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The price of a priced frequency for one request: the applicant's card is
 * saved with the processor when requesting and charged only on approval.
 */
#[Fillable([
    'frequency_request_id', 'user_id', 'frequency_id', 'amount_cents', 'currency', 'provider', 'status',
    'customer_id', 'card_id', 'card_brand', 'card_last_four', 'card_saved_at',
    'charge_reference', 'charged_at', 'failure_reason', 'failed_at', 'attempts', 'meta',
])]
class FrequencyPayment extends Model
{
    protected $attributes = [
        'status' => 'card_required',
        'attempts' => 0,
    ];

    protected function casts(): array
    {
        return [
            'status' => FrequencyPaymentStatus::class,
            'amount_cents' => 'integer',
            'attempts' => 'integer',
            'card_saved_at' => 'datetime',
            'charged_at' => 'datetime',
            'failed_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(FrequencyRequest::class, 'frequency_request_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function frequency(): BelongsTo
    {
        return $this->belongsTo(Frequency::class);
    }

    public function hasCard(): bool
    {
        return $this->card_id !== null;
    }

    /** "Visa •••• 4242" */
    public function cardLabel(): ?string
    {
        return $this->card_last_four === null ? null : trim(($this->card_brand ?? 'Tarjeta').' •••• '.$this->card_last_four);
    }
}
