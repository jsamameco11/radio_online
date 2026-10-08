<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A musical style of the shared music catalog. A song carries up to four, in
 * order; the aliases are the names music databases give it. A custom genre
 * added by a station may only be changed by that station; the starting
 * catalog and the genres the platform adds belong to no station.
 */
#[Fillable(['station_id', 'name', 'slug', 'family', 'aliases', 'sort_order', 'custom'])]
class Genre extends Model
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'station_id' => 'integer',
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

    public function station(): BelongsTo
    {
        return $this->belongsTo(Station::class);
    }

    /** Whether the station added it, so it may change or delete it. */
    public function ownedBy(?int $stationId): bool
    {
        return $stationId !== null && $this->custom && $this->station_id === $stationId;
    }

    /** @return list<string> Its name, its slug and every other name. */
    public function names(): array
    {
        return [$this->name, $this->slug, ...($this->aliases ?? [])];
    }

    /** @return array{id: string, name: string, family: string} */
    public function brief(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'family' => $this->family];
    }
}
