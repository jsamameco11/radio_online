<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Models\Frequency;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Sets an available frequency aside. Without a price nobody can request it;
 * with one, anyone can, and pays it when the staff approves the request.
 */
final class ReserveFrequency
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Frequency $frequency, ?string $note, User $actor, ?int $priceCents = null): Frequency
    {
        if ($priceCents !== null) {
            SetFrequencyPrice::ensureInRange($priceCents);
        }

        $frequency = DB::transaction(function () use ($frequency, $priceCents) {
            $frequency = Frequency::query()->lockForUpdate()->findOrFail($frequency->id);

            if ($frequency->status !== FrequencyStatus::Available) {
                throw ValidationException::withMessages(['frequency' => "La frecuencia {$frequency->display()} no está disponible para reservar."]);
            }

            $frequency->forceFill(['status' => FrequencyStatus::Reserved, 'price_cents' => $priceCents, 'reserved_at' => now()])->save();

            return $frequency;
        });

        $this->audit->record('frequency.reserved', $frequency, array_filter(['note' => $note, 'price_cents' => $priceCents]), $actor);

        return $frequency;
    }
}
