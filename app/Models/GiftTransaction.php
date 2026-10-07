<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A gift a listener sent to a station: the debit from the listener, the
 * credit to the station and the platform fee, tied together.
 */
#[Fillable([
    'gift_id', 'sender_id', 'station_id', 'quantity', 'unit_price_cents', 'total_cents', 'platform_fee_cents',
    'station_amount_cents', 'debit_transaction_id', 'credit_transaction_id', 'anonymous', 'idempotency_key',
])]
class GiftTransaction extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price_cents' => 'integer',
            'total_cents' => 'integer',
            'platform_fee_cents' => 'integer',
            'station_amount_cents' => 'integer',
            'anonymous' => 'boolean',
        ];
    }

    public function gift(): BelongsTo
    {
        return $this->belongsTo(Gift::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(Station::class);
    }

    public function message(): HasOne
    {
        return $this->hasOne(GiftMessage::class);
    }

    public function debit(): BelongsTo
    {
        return $this->belongsTo(WalletTransaction::class, 'debit_transaction_id');
    }

    public function credit(): BelongsTo
    {
        return $this->belongsTo(WalletTransaction::class, 'credit_transaction_id');
    }
}
