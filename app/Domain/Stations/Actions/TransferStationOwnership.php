<?php

namespace App\Domain\Stations\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Marketplace\Enums\ListingStatus;
use App\Domain\Stations\Enums\StationRole;
use App\Models\FrequencyListing;
use App\Models\Station;
use App\Models\StationMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Hands the station to another member of its team. The previous owner stays
 * on the team as a station manager and a listing they published is withdrawn.
 */
final class TransferStationOwnership
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Station $station, int $newOwnerId, User $actor): Station
    {
        $station = DB::transaction(function () use ($station, $newOwnerId, $actor) {
            $station = Station::query()->lockForUpdate()->findOrFail($station->id);

            if ($station->owner_id === $newOwnerId) {
                throw ValidationException::withMessages(['member' => 'Esa persona ya es la propietaria.']);
            }

            $incoming = StationMember::query()->where('station_id', $station->id)->where('user_id', $newOwnerId)->with('user')->first();

            if ($incoming === null) {
                throw ValidationException::withMessages(['member' => 'Solo puedes transferir la emisora a alguien de tu equipo.']);
            }

            if ($incoming->user->isSuspended()) {
                throw ValidationException::withMessages(['member' => 'Esa cuenta está suspendida.']);
            }

            StationMember::query()
                ->where('station_id', $station->id)
                ->where('role', StationRole::Owner->value)
                ->get()
                ->each->update(['role' => StationRole::Manager]);
            $incoming->update(['role' => StationRole::Owner]);
            $station->forceFill(['owner_id' => $newOwnerId])->save();

            FrequencyListing::query()->active()->where('station_id', $station->id)->update([
                'status' => ListingStatus::Cancelled->value,
                'cancelled_by' => $actor->id,
                'cancelled_at' => now(),
            ]);

            return $station;
        });

        $this->audit->record('station.ownership_transferred', $station, ['to_user_id' => $newOwnerId], $actor);

        return $station;
    }
}
