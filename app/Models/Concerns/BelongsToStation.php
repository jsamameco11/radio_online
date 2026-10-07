<?php

namespace App\Models\Concerns;

use App\Domain\Stations\Support\CurrentStation;
use App\Models\Station;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Data owned by one station: queries only see the current station's rows and
 * new rows are stamped with it. Without a current station (console commands,
 * the super admin panel) every row is visible.
 *
 * @mixin Model
 */
trait BelongsToStation
{
    public static function bootBelongsToStation(): void
    {
        static::addGlobalScope('station', function (Builder $query) {
            $current = app(CurrentStation::class);
            if ($current->has()) {
                $query->where($query->qualifyColumn('station_id'), $current->id());
            }
        });

        static::creating(function (self $model) {
            $current = app(CurrentStation::class);
            if ($model->getAttribute('station_id') === null && $current->has()) {
                $model->setAttribute('station_id', $current->id());
            }
        });
    }

    public function station(): BelongsTo
    {
        return $this->belongsTo(Station::class);
    }

    /**
     * Query every station's rows, ignoring the current station.
     */
    public static function acrossStations(): Builder
    {
        return static::query()->withoutGlobalScope('station');
    }
}
