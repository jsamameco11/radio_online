<?php

namespace App\Models;

use App\Domain\Wallet\Enums\WalletTransactionType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One immutable line of the ledger. Credits are positive, debits negative. */
#[Fillable([
    'wallet_id', 'type', 'amount_cents', 'balance_before_cents', 'balance_after_cents', 'currency', 'status',
    'idempotency_key', 'description', 'source_type', 'source_id', 'actor_id', 'meta', 'created_at',
])]
class WalletTransaction extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'type' => WalletTransactionType::class,
            'amount_cents' => 'integer',
            'balance_before_cents' => 'integer',
            'balance_after_cents' => 'integer',
            'meta' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
