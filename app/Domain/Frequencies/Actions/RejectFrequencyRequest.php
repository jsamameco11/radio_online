<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Frequencies\Notifications\FrequencyRequestRejected;
use App\Models\FrequencyRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Turns a pending request down with a note the requester receives. */
final class RejectFrequencyRequest
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(FrequencyRequest $request, User $reviewer, string $note): FrequencyRequest
    {
        $request = DB::transaction(function () use ($request, $reviewer, $note) {
            $request = FrequencyRequest::query()->lockForUpdate()->with(['user', 'frequency'])->findOrFail($request->id);

            if ($request->status !== FrequencyRequestStatus::Pending) {
                throw ValidationException::withMessages(['request' => 'Esta solicitud ya fue revisada.']);
            }

            $request->forceFill([
                'status' => FrequencyRequestStatus::Rejected,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'review_note' => $note,
            ])->save();

            return $request;
        });

        $this->audit->record('frequency_request.rejected', $request, ['note' => $note], $reviewer);

        $request->user->notify(new FrequencyRequestRejected(
            $request->id,
            $request->kind,
            $request->frequency->display(),
            $note,
        ));

        return $request;
    }
}
