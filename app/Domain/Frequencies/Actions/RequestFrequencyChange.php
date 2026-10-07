<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Platform\PlatformSettings;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** A station team asks the platform to move the station to another free frequency. */
final class RequestFrequencyChange
{
    public function __construct(
        private readonly PlatformSettings $settings,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(Station $station, User $requester, Frequency $target, string $reason): FrequencyRequest
    {
        if (! $this->settings->get('frequency_requests_open')) {
            throw ValidationException::withMessages(['frequency' => 'Las solicitudes de frecuencia están cerradas por ahora.']);
        }

        $request = DB::transaction(function () use ($station, $requester, $target, $reason) {
            Station::query()->lockForUpdate()->findOrFail($station->id);

            $pending = FrequencyRequest::query()
                ->where('station_id', $station->id)
                ->where('kind', FrequencyRequestKind::FrequencyChange->value)
                ->where('status', FrequencyRequestStatus::Pending->value)
                ->exists();

            if ($pending) {
                throw ValidationException::withMessages(['frequency' => 'Ya tienes un cambio de frecuencia en revisión.']);
            }

            if ($target->id === $station->frequency_id) {
                throw ValidationException::withMessages(['frequency' => 'Tu emisora ya transmite en esa frecuencia.']);
            }

            if (! $target->isAvailable()) {
                throw ValidationException::withMessages(['frequency' => "La frecuencia {$target->display()} no está disponible."]);
            }

            $request = new FrequencyRequest;
            $request->forceFill([
                'kind' => FrequencyRequestKind::FrequencyChange->value,
                'user_id' => $requester->id,
                'frequency_id' => $target->id,
                'station_id' => $station->id,
                'station_name' => $station->name,
                'pitch' => $reason,
                'category_ids' => [],
                'status' => FrequencyRequestStatus::Pending,
            ])->save();

            return $request;
        });

        $this->audit->record('frequency_request.submitted', $request, ['kind' => FrequencyRequestKind::FrequencyChange->value, 'frequency' => $target->label], $requester, $station);

        return $request;
    }
}
