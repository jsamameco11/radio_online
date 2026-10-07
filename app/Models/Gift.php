<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A gift of the catalog listeners send to stations: 🌹 Rosa $1, 👑 Corona $25… */
#[Fillable(['name', 'slug', 'emoji', 'image_path', 'price_cents', 'animation', 'sort_order', 'active'])]
class Gift extends Model
{
    protected $attributes = [
        'active' => true,
        'sort_order' => 0,
    ];

    protected function casts(): array
    {
        return [
            'price_cents' => 'integer',
            'sort_order' => 'integer',
            'active' => 'boolean',
        ];
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(GiftTransaction::class);
    }

    public function scopeAvailable(Builder $query): void
    {
        $query->where('active', true)->orderBy('sort_order')->orderBy('price_cents');
    }
}
