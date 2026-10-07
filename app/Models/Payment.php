<?php

namespace App\Models;

use App\Domain\Payments\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A wallet top-up charged through a payment provider. */
#[Fillable([
    'user_id', 'provider', 'provider_reference', 'amount_cents', 'currency', 'status',
    'wallet_transaction_id', 'checkout_url', 'paid_at', 'failure_reason', 'meta',
])]
class Payment extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'status' => PaymentStatus::class,
            'amount_cents' => 'integer',
            'paid_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function walletTransaction(): BelongsTo
    {
        return $this->belongsTo(WalletTransaction::class);
    }
}
