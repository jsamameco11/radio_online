<?php

namespace App\Domain\Monetization\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Monetization\Enums\MonetizationRequestStatus;
use App\Domain\Monetization\Notifications\MonetizationRejected;
use App\Domain\Stations\Support\StationLinks;
use App\Models\MonetizationRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** The platform turns a monetization request down, with a note the owner receives. */
final class RejectMonetization
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(MonetizationRequest $request, User $reviewer, string $note): MonetizationRequest
    {
        $request = DB::transaction(function () use ($request, $reviewer, $note) {
            $request = MonetizationRequest::acrossStations()->lockForUpdate()->with(['station.frequency', 'station.owner'])->findOrFail($request->id);

            if ($request->status !== MonetizationRequestStatus::Pending) {
                throw ValidationException::withMessages(['request' => 'Esta solicitud ya fue revisada.']);
            }

            $request->forceFill([
                'status' => MonetizationRequestStatus::Rejected,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'review_note' => $note,
            ])->save();

            return $request;
        });

        $station = $request->station;
        $this->audit->record('monetization.reject', $request, ['note' => $note], $reviewer, $station);

        $station->owner?->notify(new MonetizationRejected(
            $station->id,
            $station->displayName(),
            StationLinks::studio($station).'/monetizacion',
            $note,
            RequestMonetization::RETRY_AFTER_DAYS,
        ));

        return $request;
    }
}
