<?php

namespace App\Domain\Monetization\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Monetization\Enums\MonetizationRequestStatus;
use App\Domain\Monetization\MonetizationEligibility;
use App\Models\MonetizationRequest;
use App\Models\Station;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A station that meets the monetization requirements asks to become a
 * "Radio monetizada". Eligibility is evaluated here, never trusted from the
 * client; one pending request per station, and a rejected station waits
 * RETRY_AFTER_DAYS before asking again.
 */
final class RequestMonetization
{
    public const RETRY_AFTER_DAYS = 7;

    public function __construct(
        private readonly MonetizationEligibility $eligibility,
        private readonly AuditTrail $audit,
    ) {}

    /** When a station whose last request was rejected may ask again. */
    public static function retryAt(?MonetizationRequest $latest): ?CarbonImmutable
    {
        if ($latest?->status !== MonetizationRequestStatus::Rejected || $latest->reviewed_at === null) {
            return null;
        }

        $retryAt = $latest->reviewed_at->toImmutable()->addDays(self::RETRY_AFTER_DAYS);

        return $retryAt->isFuture() ? $retryAt : null;
    }

    public function handle(Station $station, User $user): MonetizationRequest
    {
        $request = DB::transaction(function () use ($station, $user) {
            $station = Station::query()->lockForUpdate()->findOrFail($station->id);

            if ($station->isMonetized()) {
                throw ValidationException::withMessages(['monetization' => 'Tu radio ya es una Radio monetizada.']);
            }

            $latest = MonetizationRequest::acrossStations()->where('station_id', $station->id)->latest('id')->first();

            if ($latest?->status === MonetizationRequestStatus::Pending) {
                throw ValidationException::withMessages(['monetization' => 'Ya enviaste tu solicitud: la estamos revisando.']);
            }

            $retryAt = self::retryAt($latest);
            if ($retryAt !== null) {
                throw ValidationException::withMessages([
                    'monetization' => 'Podrás volver a solicitarla desde el '.$retryAt->setTimezone((string) config('platform.timezone'))->format('d/m/Y').'.',
                ]);
            }

            $eligibility = $this->eligibility->evaluate($station);
            if (! $eligibility->eligible()) {
                throw ValidationException::withMessages(['monetization' => 'Tu radio todavía no cumple los requisitos de monetización. ¡Sigue así, vas por buen camino!']);
            }

            return MonetizationRequest::query()->create([
                'station_id' => $station->id,
                'requested_by' => $user->id,
                'status' => MonetizationRequestStatus::Pending,
                'subscribers' => $eligibility->subscribers,
                'snapshot' => $eligibility->snapshot(),
            ]);
        });

        $this->audit->record('monetization.request', $request, ['subscribers' => $request->subscribers], $user);

        return $request;
    }
}
