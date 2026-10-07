<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Models\Frequency;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Sets an available frequency aside so nobody can request it. */
final class ReserveFrequency
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Frequency $frequency, ?string $note, User $actor): Frequency
    {
        $frequency = DB::transaction(function () use ($frequency) {
            $frequency = Frequency::query()->lockForUpdate()->findOrFail($frequency->id);

            if ($frequency->status !== FrequencyStatus::Available) {
                throw ValidationException::withMessages(['frequency' => "La frecuencia {$frequency->display()} no está disponible para reservar."]);
            }

            $frequency->forceFill(['status' => FrequencyStatus::Reserved, 'reserved_at' => now()])->save();

            return $frequency;
        });

        $this->audit->record('frequency.reserved', $frequency, array_filter(['note' => $note]), $actor);

        return $frequency;
    }
}
