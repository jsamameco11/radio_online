<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyPaymentStatus;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Payments\PaymentGateways;
use App\Domain\Platform\PlatformSettings;
use App\Domain\Wallet\WalletLedger;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A listener asks for an available frequency to open a station on it. The
 * frequency stays available until the platform approves the request; each
 * user has at most the platform's max_pending_requests open.
 *
 * A priced frequency (reserved with a price) can be requested too: the
 * request carries a payment for that price, charged to the applicant's card
 * only when the staff approves it.
 */
final class SubmitFrequencyRequest
{
    public function __construct(
        private readonly AuditTrail $audit,
        private readonly PlatformSettings $settings,
        private readonly PaymentGateways $gateways,
    ) {}

    public function atLimit(User $user): bool
    {
        $open = $user->frequencyRequests()
            ->where('kind', FrequencyRequestKind::NewStation->value)
            ->whereIn('status', [FrequencyRequestStatus::Pending->value, FrequencyRequestStatus::AwaitingPayment->value])
            ->count();

        return $open >= max(1, (int) $this->settings->get('max_pending_requests'));
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
            if (! $frequency->isRequestable()) {
                throw ValidationException::withMessages(['frequency_id' => "La frecuencia {$frequency->display()} ya no está disponible. Elige otra."]);
            }

            $request = $user->frequencyRequests()->create([
                'frequency_id' => $frequency->id,
                'station_name' => $stationName,
                'pitch' => $pitch,
                'category_ids' => array_values(array_unique($categoryIds)),
                'status' => FrequencyRequestStatus::Pending,
            ]);

            return $request->setRelation('payment', $frequency->isPriced() ? $request->payment()->create([
                'user_id' => $user->id,
                'frequency_id' => $frequency->id,
                'amount_cents' => $frequency->price_cents,
                'currency' => WalletLedger::currency(),
                'provider' => $this->gateways->cards()->name(),
                'status' => FrequencyPaymentStatus::CardRequired,
            ]) : null);
        });

        $this->audit->record('frequency_request.submitted', $request, array_filter([
            'frequency' => $frequency->label,
            'price_cents' => $request->payment?->amount_cents,
        ]), $user);

        return $request;
    }
}
