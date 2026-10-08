<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Frequencies\Support\ReleaseFrequencyPayment;
use App\Models\FrequencyRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** The requester withdraws a request still open (in review or waiting for their payment). */
final class CancelFrequencyRequest
{
    public function __construct(
        private readonly AuditTrail $audit,
        private readonly ReleaseFrequencyPayment $release,
    ) {}

    public function handle(FrequencyRequest $request, User $actor): FrequencyRequest
    {
        $request = DB::transaction(function () use ($request) {
            $request = FrequencyRequest::query()->lockForUpdate()->with('payment')->findOrFail($request->id);

            if (! $request->status->isOpen()) {
                throw ValidationException::withMessages(['request' => 'Esta solicitud ya fue revisada.']);
            }

            $this->release->ensureReleasable($request);
            $request->forceFill(['status' => FrequencyRequestStatus::Cancelled])->save();

            return $request;
        });

        $this->release->handle($request);
        $this->audit->record('frequency_request.cancelled', $request, [], $actor);

        return $request;
    }
}
