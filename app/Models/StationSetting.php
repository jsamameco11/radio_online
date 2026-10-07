<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One settings group of a station (e.g. "broadcast", "gifts"), stored as JSON.
 * The row is identified by station and key together.
 */
#[Fillable(['station_id', 'key', 'value', 'updated_at'])]
class StationSetting extends Model
{
    public const CREATED_AT = null;

    public $incrementing = false;

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['value' => 'array'];
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(Station::class);
    }

    protected function setKeysForSaveQuery($query): Builder
    {
        return $query
            ->where('station_id', $this->getOriginal('station_id', $this->getAttribute('station_id')))
            ->where('key', $this->getOriginal('key', $this->getAttribute('key')));
    }
}
