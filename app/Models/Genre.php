<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A musical style of the shared music catalog. A song carries up to four, in
 * order; the aliases are the names music databases give it.
 */
#[Fillable(['name', 'slug', 'family', 'aliases', 'sort_order', 'custom'])]
class Genre extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'aliases' => 'array',
            'sort_order' => 'integer',
            'custom' => 'boolean',
        ];
    }

    public function tracks(): BelongsToMany
    {
        return $this->belongsToMany(Track::class)->withPivot('position');
    }

    public function artists(): BelongsToMany
    {
        return $this->belongsToMany(Artist::class)->withPivot('position');
    }

    /** @return array{id: string, name: string, family: string} */
    public function brief(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'family' => $this->family];
    }
}
