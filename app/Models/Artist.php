<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A singer or group of the shared music catalog: its other spellings, whether
 * it is a soloist or a group, its country and the genres it is known for.
 * The station that added it (by hand or learned from its uploads) is the only
 * one that may change it; the starting catalog belongs to no station.
 */
#[Fillable(['station_id', 'name', 'slug', 'aliases', 'kind', 'country', 'source', 'musicbrainz_id'])]
class Artist extends Model
{
    use HasUuids;

    public const CATALOG = 'catalog';

    public const LEARNED = 'learned';

    public const MANUAL = 'manual';

    public const SOURCES = [self::CATALOG => 'Catálogo inicial', self::LEARNED => 'Aprendido al subir', self::MANUAL => 'Agregado a mano'];

    protected function casts(): array
    {
        return ['aliases' => 'array', 'station_id' => 'integer'];
    }

    public function genres(): BelongsToMany
    {
        return $this->belongsToMany(Genre::class)
            ->withPivot('position')
            ->orderByPivot('position');
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(Station::class);
    }

    /** Whether the station added it, so it may change or delete it. */
    public function ownedBy(?int $stationId): bool
    {
        return $stationId !== null && $this->station_id === $stationId;
    }

    /** @return list<string> Its name and every other spelling. */
    public function names(): array
    {
        return [$this->name, ...($this->aliases ?? [])];
    }
}
