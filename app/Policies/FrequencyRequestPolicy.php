<?php

namespace App\Policies;

use App\Domain\Frequencies\Actions\SubmitFrequencyRequest;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Models\FrequencyRequest;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/** Who may ask the platform for a frequency, and withdraw the request. */
class FrequencyRequestPolicy
{
    public function __construct(private readonly SubmitFrequencyRequest $submit) {}

    /** Up to the platform's limit of requests under review at a time. */
    public function create(User $user): Response
    {
        return $this->submit->atLimit($user)
            ? Response::deny('Ya tienes solicitudes en revisión. Espera la respuesta antes de enviar otra.')
            : Response::allow();
    }

    /** Only the applicant, and only while it is under review. */
    public function cancel(User $user, FrequencyRequest $request): bool
    {
        return $request->user_id === $user->id && $request->status === FrequencyRequestStatus::Pending;
    }
}
