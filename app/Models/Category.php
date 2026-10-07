<?php

namespace App\Models;

use App\Domain\Discovery\Enums\CategoryGroup;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** A style a station can pick (up to three): Salsa, Noticias, Humor… */
#[Fillable(['name', 'slug', 'group', 'sort_order', 'active'])]
class Category extends Model
{
    protected function casts(): array
    {
        return [
            'group' => CategoryGroup::class,
            'sort_order' => 'integer',
            'active' => 'boolean',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function stations(): BelongsToMany
    {
        return $this->belongsToMany(Station::class)->withPivot('position');
    }

    public function scopeActive(Builder $query): void
    {
        $query->where('active', true)->orderBy('sort_order')->orderBy('name');
    }
}
