<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Actions\OpenStation;
use App\Domain\Stations\Notifications\StationAssigned;
use App\Domain\Stations\Support\StationLinks;
use App\Models\Frequency;
use App\Models\Station;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/** The staff opens a station for a user on a free or reserved frequency. */
final class AssignFrequency
{
    public function __construct(
        private readonly OpenStation $open,
        private readonly AuditTrail $audit,
    ) {}

    /**
     * @param  list<int>  $categoryIds
     */
    public function handle(Frequency $frequency, User $owner, string $name, array $categoryIds, User $actor): Station
    {
        if ($owner->isSuspended()) {
            throw ValidationException::withMessages(['email' => 'Esa cuenta está suspendida.']);
        }

        try {
            $station = $this->open->handle($owner, $frequency, $name, $categoryIds);
        } catch (InvalidArgumentException) {
            throw ValidationException::withMessages(['frequency' => "La frecuencia {$frequency->display()} ya no está libre."]);
        }

        $this->audit->record('frequency.assigned', $station, ['frequency' => $frequency->label, 'owner_id' => $owner->id], $actor);
        $owner->notify(new StationAssigned($station->id, $station->displayName(), StationLinks::studio($station)));

        return $station;
    }
}
