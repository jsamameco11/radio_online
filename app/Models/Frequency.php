<?php

namespace App\Models;

use App\Domain\Frequencies\Enums\FrequencyStatus;
use Database\Factories\FrequencyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A virtual frequency of the dial, e.g. 89.30. Its slug ("89-30") is the
 * public address of the station that broadcasts on it.
 */
#[Fillable(['frequency', 'label', 'slug', 'band', 'status', 'price_cents', 'reserved_at', 'activated_at'])]
class Frequency extends Model
{
    /** @use HasFactory<FrequencyFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'frequency' => 'decimal:2',
            'status' => FrequencyStatus::class,
            'price_cents' => 'integer',
            'reserved_at' => 'datetime',
            'activated_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function station(): HasOne
    {
        return $this->hasOne(Station::class);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(FrequencyRequest::class);
    }

    /** "89.30": the number alone, never a radio band. */
    public function display(): string
    {
        return $this->label;
    }

    /**
     * Frequencies still free to assign, in dial order.
     *
     * @return list<array{label: string, display: string}>
     */
    public static function freeOptions(): array
    {
        return self::query()
            ->available()
            ->onDial()
            ->get(['label'])
            ->map(fn (self $frequency): array => [
                'label' => $frequency->label,
                'display' => $frequency->display(),
            ])
            ->all();
    }

    public function isAvailable(): bool
    {
        return $this->status === FrequencyStatus::Available;
    }

    /** Reserved by the platform with a price: anyone can request it and pays on approval. */
    public function isPriced(): bool
    {
        return $this->status === FrequencyStatus::Reserved && $this->price_cents !== null;
    }

    /** Free ones and priced ones: what "Obtén tu frecuencia" offers. */
    public function isRequestable(): bool
    {
        return $this->isAvailable() || $this->isPriced();
    }

    public function scopeAvailable(Builder $query): void
    {
        $query->where('status', FrequencyStatus::Available->value);
    }

    public function scopeRequestable(Builder $query): void
    {
        $query->where(fn (Builder $query) => $query
            ->where('status', FrequencyStatus::Available->value)
            ->orWhere(fn (Builder $query) => $query->where('status', FrequencyStatus::Reserved->value)->whereNotNull('price_cents')));
    }

    public function scopeOnDial(Builder $query): void
    {
        $query->orderBy('frequency');
    }
}
