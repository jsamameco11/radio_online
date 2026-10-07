<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** A #hashtag, stored once by its normalized slug ("futbol" for #Fútbol). */
#[Fillable(['name', 'slug', 'uses_count'])]
class Hashtag extends Model
{
    protected function casts(): array
    {
        return ['uses_count' => 'integer'];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function stations(): BelongsToMany
    {
        return $this->belongsToMany(Station::class)->withPivot('position');
    }

    public function topics(): BelongsToMany
    {
        return $this->belongsToMany(CurrentTopic::class)->withPivot('position');
    }

    public function episodes(): BelongsToMany
    {
        return $this->belongsToMany(Episode::class)->withPivot('position');
    }
}
