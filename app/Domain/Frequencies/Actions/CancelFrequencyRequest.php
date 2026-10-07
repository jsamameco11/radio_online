<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Models\FrequencyRequest;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/** The requester withdraws a request that is still pending. */
final class CancelFrequencyRequest
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(FrequencyRequest $request, User $actor): FrequencyRequest
    {
        if ($request->status !== FrequencyRequestStatus::Pending) {
            throw ValidationException::withMessages(['request' => 'Esta solicitud ya fue revisada.']);
        }

        $request->forceFill(['status' => FrequencyRequestStatus::Cancelled])->save();
        $this->audit->record('frequency_request.cancelled', $request, [], $actor);

        return $request;
    }
}
