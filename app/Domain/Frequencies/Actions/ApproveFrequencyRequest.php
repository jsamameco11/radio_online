<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Frequencies\Notifications\FrequencyRequestApproved;
use App\Domain\Stations\Actions\MoveStationFrequency;
use App\Domain\Stations\Actions\OpenStation;
use App\Domain\Stations\Support\StationLinks;
use App\Models\Category;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Approves a pending request: a new station opens on the frequency (with the
 * requested name and categories), or the requesting station moves to it.
 * When the frequency was taken meanwhile, the reviewer may pick another one.
 */
final class ApproveFrequencyRequest
{
    public function __construct(
        private readonly OpenStation $open,
        private readonly MoveStationFrequency $move,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(FrequencyRequest $request, User $reviewer, ?Frequency $alternative = null, ?string $note = null): Station
    {
        [$request, $station] = DB::transaction(function () use ($request, $reviewer, $alternative, $note) {
            $request = FrequencyRequest::query()->lockForUpdate()->with('user')->findOrFail($request->id);

            if ($request->status !== FrequencyRequestStatus::Pending) {
                throw ValidationException::withMessages(['request' => 'Esta solicitud ya fue revisada.']);
            }

            if ($request->user->isSuspended()) {
                throw ValidationException::withMessages(['request' => 'La cuenta que pidió la frecuencia está suspendida.']);
            }

            $frequency = $alternative ?? Frequency::query()->findOrFail($request->frequency_id);
            $station = $request->kind === FrequencyRequestKind::FrequencyChange
                ? $this->moveStation($request, $frequency)
                : $this->openStation($request, $frequency);

            $request->forceFill([
                'status' => FrequencyRequestStatus::Approved,
                'frequency_id' => $frequency->id,
                'station_id' => $station->id,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'review_note' => $note,
            ])->save();

            return [$request, $station];
        });

        $this->audit->record('frequency_request.approved', $request, [
            'kind' => $request->kind->value,
            'frequency' => $station->frequency->label,
            'station_id' => $station->id,
        ], $reviewer, $station);

        $request->user->notify(new FrequencyRequestApproved(
            $request->id,
            $request->kind,
            $station->displayName(),
            StationLinks::studio($station),
            $note,
        ));

        return $station;
    }

    private function openStation(FrequencyRequest $request, Frequency $frequency): Station
    {
        $categoryIds = Category::query()
            ->whereIn('id', array_map('intval', $request->category_ids ?? []))
            ->where('active', true)
            ->pluck('id')
            ->all();
        $ordered = array_values(array_filter(array_map('intval', $request->category_ids ?? []), fn (int $id) => in_array($id, $categoryIds, true)));

        try {
            return $this->open->handle($request->user, $frequency, $request->station_name, $ordered);
        } catch (InvalidArgumentException) {
            throw ValidationException::withMessages(['frequency' => "La frecuencia {$frequency->display()} ya no está disponible. Elige otra para aprobar la solicitud."]);
        }
    }

    private function moveStation(FrequencyRequest $request, Frequency $frequency): Station
    {
        $station = Station::query()->find($request->station_id)
            ?? throw ValidationException::withMessages(['request' => 'La emisora de esta solicitud ya no existe.']);

        $previous = Frequency::query()->findOrFail($station->frequency_id);
        $station = $this->move->handle($station, $frequency);

        $this->audit->record('station.frequency_changed', $station, ['from' => $previous->label, 'to' => $frequency->label]);

        return $station;
    }
}
