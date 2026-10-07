<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A singer or group of the shared music catalog: its other spellings, whether
 * it is a soloist or a group, its country and the genres it is known for.
 */
#[Fillable(['name', 'slug', 'aliases', 'kind', 'country', 'source', 'musicbrainz_id'])]
class Artist extends Model
{
    use HasUuids;

    public const SOURCES = ['catalog' => 'Catálogo inicial', 'learned' => 'Aprendido al subir', 'manual' => 'Agregado a mano'];

    protected function casts(): array
    {
        return ['aliases' => 'array'];
    }

    public function genres(): BelongsToMany
    {
        return $this->belongsToMany(Genre::class)
            ->withPivot('position')
            ->orderByPivot('position');
    }
}
