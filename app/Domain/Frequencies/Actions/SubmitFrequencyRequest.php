<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Platform\PlatformSettings;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A listener asks for an available frequency to open a station on it. The
 * frequency stays available until the platform approves the request; each
 * user has at most the platform's max_pending_requests under review.
 */
final class SubmitFrequencyRequest
{
    public function __construct(
        private readonly AuditTrail $audit,
        private readonly PlatformSettings $settings,
    ) {}

    public function atLimit(User $user): bool
    {
        $pending = $user->frequencyRequests()
            ->where('kind', FrequencyRequestKind::NewStation->value)
            ->where('status', FrequencyRequestStatus::Pending->value)
            ->count();

        return $pending >= max(1, (int) $this->settings->get('max_pending_requests'));
    }

    /**
     * @param  list<int>  $categoryIds
     *
     * @throws ValidationException
     */
    public function handle(User $user, Frequency $frequency, string $stationName, string $pitch, array $categoryIds): FrequencyRequest
    {
        $request = DB::transaction(function () use ($user, $frequency, $stationName, $pitch, $categoryIds) {
            User::query()->whereKey($user->id)->lockForUpdate()->first();

            if ($this->atLimit($user)) {
                throw ValidationException::withMessages(['frequency_id' => 'Ya tienes solicitudes en revisión. Espera la respuesta antes de enviar otra.']);
            }

            $frequency = Frequency::query()->lockForUpdate()->findOrFail($frequency->id);
            if (! $frequency->isAvailable()) {
                throw ValidationException::withMessages(['frequency_id' => "La frecuencia {$frequency->display()} ya no está disponible. Elige otra."]);
            }

            return $user->frequencyRequests()->create([
                'frequency_id' => $frequency->id,
                'station_name' => $stationName,
                'pitch' => $pitch,
                'category_ids' => array_values(array_unique($categoryIds)),
                'status' => FrequencyRequestStatus::Pending,
            ]);
        });

        $this->audit->record('frequency_request.submitted', $request, ['frequency' => $frequency->label], $user);

        return $request;
    }
}
