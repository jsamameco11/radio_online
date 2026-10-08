<?php

namespace App\Models;

use App\Domain\Marketplace\Enums\ListingStatus;
use App\Domain\Marketplace\Enums\SalePayoutStatus;
use App\Domain\Monetization\Enums\PayoutMethod;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Something on sale in Frecuencias en venta:
 * - a whole station its owner sells (frequency, name, audience and content).
 *   Once bought it keeps the record of the payout the platform owes the
 *   seller (price minus processor fee, commission and tax, plus what was left
 *   in the station wallet);
 * - a free frequency the platform sells itself (by_platform, no station
 *   until it is bought; seller_id is the staff member who listed it and
 *   nobody gets paid out).
 *
 * payout_details holds holder, account and, for bank transfers, the bank,
 * encrypted at rest.
 */
#[Fillable([
    'by_platform', 'station_id', 'frequency_id', 'seller_id', 'price_cents', 'currency', 'pitch', 'status', 'payout_method', 'payout_details',
    'buyer_id', 'sold_at', 'processor_fee_cents', 'fee_cents', 'tax_cents', 'settled_balance_cents', 'payout_cents', 'purchase_transaction_id',
    'payout_status', 'payout_reference', 'payout_note', 'paid_by', 'paid_at', 'cancelled_by', 'cancelled_at',
])]
#[Hidden(['payout_details'])]
class FrequencyListing extends Model
{
    protected $attributes = [
        'status' => 'active',
        'by_platform' => false,
    ];

    protected function casts(): array
    {
        return [
            'by_platform' => 'boolean',
            'price_cents' => 'integer',
            'status' => ListingStatus::class,
            'payout_method' => PayoutMethod::class,
            'payout_details' => 'encrypted:array',
            'sold_at' => 'datetime',
            'processor_fee_cents' => 'integer',
            'fee_cents' => 'integer',
            'tax_cents' => 'integer',
            'settled_balance_cents' => 'integer',
            'payout_cents' => 'integer',
            'payout_status' => SalePayoutStatus::class,
            'paid_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(Station::class);
    }

    public function frequency(): BelongsTo
    {
        return $this->belongsTo(Frequency::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    /** @param  Builder<self>  $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('status', ListingStatus::Active->value);
    }

    public function isActive(): bool
    {
        return $this->status === ListingStatus::Active;
    }

    /** "US$ 1,500.00" */
    public static function money(int $cents, string $currency): string
    {
        return ($currency === 'USD' ? 'US$' : $currency).' '.number_format($cents / 100, 2);
    }

    public function formattedPrice(): string
    {
        return self::money($this->price_cents, $this->currency);
    }

    public function maskedDestination(): ?string
    {
        return $this->payout_method?->mask((string) ($this->payout_details['account'] ?? ''));
    }
}
