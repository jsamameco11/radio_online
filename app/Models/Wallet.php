<?php

namespace App\Models;

use App\Domain\Wallet\Enums\WalletStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * The balance of a listener (to send gifts) or a station (gifts received).
 * Only App\Domain\Wallet\WalletLedger changes it, always through a transaction.
 */
#[Fillable(['owner_type', 'owner_id', 'currency', 'status'])]
class Wallet extends Model
{
    protected $attributes = [
        'balance_cents' => 0,
        'status' => 'active',
    ];

    protected function casts(): array
    {
        return [
            'balance_cents' => 'integer',
            'status' => WalletStatus::class,
        ];
    }

    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class)->latest('id');
    }
}
