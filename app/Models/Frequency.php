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
 * A virtual frequency of the dial, e.g. 89.30 FM. Its slug ("89-30") is the
 * public address of the station that broadcasts on it.
 */
#[Fillable(['frequency', 'label', 'slug', 'band', 'status', 'reserved_at', 'activated_at'])]
class Frequency extends Model
{
    /** @use HasFactory<FrequencyFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'frequency' => 'decimal:2',
            'status' => FrequencyStatus::class,
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

    /** "89.30 FM" */
    public function display(): string
    {
        return $this->label.' '.$this->band;
    }

    public function isAvailable(): bool
    {
        return $this->status === FrequencyStatus::Available;
    }

    public function scopeAvailable(Builder $query): void
    {
        $query->where('status', FrequencyStatus::Available->value);
    }

    public function scopeOnDial(Builder $query): void
    {
        $query->orderBy('frequency');
    }
}
