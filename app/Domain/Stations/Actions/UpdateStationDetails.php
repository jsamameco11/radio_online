<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Audit\AuditTrail;
use App\Models\Station;
use App\Models\User;

/**
 * Updates the public details of a station (name, texts, visibility, look,
 * language and country) and audits what changed. Used by the studio and by
 * the platform staff.
 */
final class UpdateStationDetails
{
    private const FIELDS = ['name', 'tagline', 'description', 'visibility', 'accent_color', 'language', 'country'];

    public function __construct(private readonly AuditTrail $audit) {}

    /**
     * @param  array<string, mixed>  $details
     */
    public function handle(Station $station, array $details, User $actor): Station
    {
        $station->fill(array_intersect_key($details, array_flip(self::FIELDS)));
        $dirty = array_keys($station->getDirty());

        if ($dirty === []) {
            return $station;
        }

        $meta = ['fields' => $dirty];
        if ($station->isDirty('name')) {
            $meta['name'] = [$station->getOriginal('name'), $station->name];
        }

        $station->save();
        $this->audit->record('station.updated', $station, $meta, $actor);

        return $station;
    }
}
