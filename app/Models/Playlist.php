<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStation;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Songs in the order the programmer chose. The automatic music plays one
 * list, or all of them together, in that order or shuffled.
 */
#[Fillable(['station_id', 'name', 'description', 'sort_order'])]
class Playlist extends Model
{
    use BelongsToStation, HasUuids;

    protected function casts(): array
    {
        return ['sort_order' => 'integer'];
    }

    public function tracks(): BelongsToMany
    {
        return $this->belongsToMany(Track::class)
            ->withPivot('position')
            ->orderByPivot('position');
    }
}
