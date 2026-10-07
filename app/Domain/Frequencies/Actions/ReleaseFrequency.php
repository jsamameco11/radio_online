<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Models\Frequency;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Makes a frequency available again. Only possible when no station
 * broadcasts on it (it was never used, or its station was closed).
 */
final class ReleaseFrequency
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Frequency $frequency, User $actor): Frequency
    {
        $frequency = DB::transaction(function () use ($frequency) {
            $frequency = Frequency::query()->lockForUpdate()->findOrFail($frequency->id);

            if ($frequency->station()->exists()) {
                throw ValidationException::withMessages(['frequency' => 'Una emisora transmite en esta frecuencia: ciérrala o múdala antes de liberarla.']);
            }

            if ($frequency->status === FrequencyStatus::Available) {
                throw ValidationException::withMessages(['frequency' => 'La frecuencia ya está libre.']);
            }

            $frequency->forceFill(['status' => FrequencyStatus::Available, 'reserved_at' => null, 'activated_at' => null])->save();

            return $frequency;
        });

        $this->audit->record('frequency.released', $frequency, [], $actor);

        return $frequency;
    }
}
