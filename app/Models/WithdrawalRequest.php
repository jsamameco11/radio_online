<?php

namespace App\Models;

use App\Domain\Monetization\Enums\PayoutMethod;
use App\Domain\Monetization\Enums\WithdrawalStatus;
use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A station taking money out of its wallet. The amount is debited when it is
 * requested; the platform then pays it (with a reference) or rejects it and
 * the amount goes back to the wallet.
 *
 * payout_details holds holder, account and, for bank transfers, the bank,
 * encrypted at rest.
 */
#[Fillable([
    'station_id', 'requested_by', 'amount_cents', 'currency', 'status', 'payout_method', 'payout_details',
    'debit_transaction_id', 'reversal_transaction_id', 'paid_reference', 'reviewed_by', 'reviewed_at', 'review_note',
])]
#[Hidden(['payout_details'])]
class WithdrawalRequest extends Model
{
    use BelongsToStation;

    protected $attributes = [
        'status' => 'pending',
    ];

    protected function casts(): array
    {
        return [
            'amount_cents' => 'integer',
            'status' => WithdrawalStatus::class,
            'payout_method' => PayoutMethod::class,
            'payout_details' => 'encrypted:array',
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

    /** "US$ 50.00" */
    public function formattedAmount(): string
    {
        return ($this->currency === 'USD' ? 'US$' : $this->currency).' '.number_format($this->amount_cents / 100, 2);
    }

    /** "Yape · ···· 4321" */
    public function maskedDestination(): string
    {
        return $this->payout_method->mask((string) ($this->payout_details['account'] ?? ''));
    }
}
