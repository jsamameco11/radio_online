<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyPaymentStatus;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Frequencies\FrequencyCharges;
use App\Domain\Frequencies\Notifications\FrequencyPaymentFailed;
use App\Domain\Frequencies\Notifications\FrequencyRequestApproved;
use App\Domain\Payments\Enums\ChargeStatus;
use App\Domain\Platform\PlatformHost;
use App\Domain\Stations\Actions\MoveStationFrequency;
use App\Domain\Stations\Actions\OpenStation;
use App\Domain\Stations\Support\StationLinks;
use App\Models\Category;
use App\Models\Frequency;
use App\Models\FrequencyListing;
use App\Models\FrequencyPayment;
use App\Models\FrequencyRequest;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Approves an open request: a new station opens on the frequency (with the
 * requested name and categories), or the requesting station moves to it.
 * When the frequency was taken meanwhile, the reviewer may pick another one.
 *
 * A priced frequency is charged to the applicant's card first. When the bank
 * declines, the request waits for the applicant to pay with another card
 * (null is returned) and the station opens as soon as they do.
 */
final class ApproveFrequencyRequest
{
    public function __construct(
        private readonly OpenStation $open,
        private readonly MoveStationFrequency $move,
        private readonly FrequencyCharges $charges,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(FrequencyRequest $request, User $reviewer, ?Frequency $alternative = null, ?string $note = null): ?Station
    {
        $payment = FrequencyPayment::query()->where('frequency_request_id', $request->id)->first();

        if ($payment !== null && $payment->status !== FrequencyPaymentStatus::Paid && ! $this->charge($request->refresh(), $payment, $reviewer, $alternative, $note)) {
            return null;
        }

        [$request, $station] = DB::transaction(function () use ($request, $reviewer, $alternative, $note) {
            $request = FrequencyRequest::query()->lockForUpdate()->with(['user', 'payment'])->findOrFail($request->id);

            if (! $request->status->isOpen()) {
                throw ValidationException::withMessages(['request' => 'Esta solicitud ya fue revisada.']);
            }

            if ($request->payment !== null && $request->payment->status !== FrequencyPaymentStatus::Paid) {
                throw ValidationException::withMessages(['request' => 'Falta el pago de esta frecuencia.']);
            }

            if ($request->user->isSuspended()) {
                throw ValidationException::withMessages(['request' => 'La cuenta que pidió la frecuencia está suspendida.']);
            }

            $frequency = $alternative ?? Frequency::query()->findOrFail($request->frequency_id);
            $station = $request->kind === FrequencyRequestKind::FrequencyChange
                ? $this->moveStation($request, $frequency)
                : $this->openStation($request, $frequency);

            $request->forceFill([
                'status' => FrequencyRequestStatus::Approved,
                'frequency_id' => $frequency->id,
                'station_id' => $station->id,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'review_note' => $note,
            ])->save();

            return [$request, $station];
        });

        $this->audit->record('frequency_request.approved', $request, array_filter([
            'kind' => $request->kind->value,
            'frequency' => $station->frequency->label,
            'station_id' => $station->id,
            'paid_cents' => $request->payment?->amount_cents,
        ]), $reviewer, $station);

        $request->user->notify(new FrequencyRequestApproved(
            $request->id,
            $request->kind,
            $station->displayName(),
            StationLinks::studio($station),
            $note,
        ));

        return $station;
    }

    /** Charges the card on file; false when it was declined and the request now waits for the applicant. */
    private function charge(FrequencyRequest $request, FrequencyPayment $payment, User $reviewer, ?Frequency $alternative, ?string $note): bool
    {
        if ($request->status !== FrequencyRequestStatus::Pending) {
            throw ValidationException::withMessages(['request' => $request->status === FrequencyRequestStatus::AwaitingPayment
                ? 'Esta solicitud ya está aprobada y espera el pago de la persona.'
                : 'Esta solicitud ya fue revisada.']);
        }

        if ($alternative !== null && $alternative->id !== $request->frequency_id) {
            throw ValidationException::withMessages(['frequency' => 'Esta frecuencia tiene precio: solo puedes aprobarla en la frecuencia que se pidió.']);
        }

        $request->loadMissing(['user', 'frequency']);

        if ($request->user->isSuspended()) {
            throw ValidationException::withMessages(['request' => 'La cuenta que pidió la frecuencia está suspendida.']);
        }

        self::ensureFree($request->frequency);

        $result = $this->charges->chargeSavedCard($payment, $reviewer);

        if ($result->status === ChargeStatus::Succeeded) {
            return true;
        }

        $request->forceFill([
            'status' => FrequencyRequestStatus::AwaitingPayment,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'review_note' => $note,
        ])->save();

        $this->audit->record('frequency_request.awaiting_payment', $request, ['reason' => $result->message], $reviewer);

        $request->user->notify(new FrequencyPaymentFailed(
            $request->id,
            $request->frequency->display(),
            FrequencyListing::money($payment->amount_cents, $payment->currency),
            (string) $result->message,
            PlatformHost::Public->url('/obten-tu-frecuencia/solicitudes/'.$request->id.'/pago'),
        ));

        return false;
    }

    /**
     * Nobody is charged for a frequency that someone else got meanwhile.
     *
     * @throws ValidationException
     */
    public static function ensureFree(Frequency $frequency): void
    {
        $frequency->refresh();

        if (! in_array($frequency->status, [FrequencyStatus::Available, FrequencyStatus::Reserved], true) || $frequency->station()->exists()) {
            throw ValidationException::withMessages(['frequency' => "La frecuencia {$frequency->display()} ya no está libre: no se cobró nada."]);
        }
    }

    private function openStation(FrequencyRequest $request, Frequency $frequency): Station
    {
        $categoryIds = Category::query()
            ->whereIn('id', array_map('intval', $request->category_ids ?? []))
            ->where('active', true)
            ->pluck('id')
            ->all();
        $ordered = array_values(array_filter(array_map('intval', $request->category_ids ?? []), fn (int $id) => in_array($id, $categoryIds, true)));

        try {
            return $this->open->handle($request->user, $frequency, $request->station_name, $ordered);
        } catch (InvalidArgumentException) {
            throw ValidationException::withMessages(['frequency' => "La frecuencia {$frequency->display()} ya no está disponible. Elige otra para aprobar la solicitud."]);
        }
    }

    private function moveStation(FrequencyRequest $request, Frequency $frequency): Station
    {
        $station = Station::query()->find($request->station_id)
            ?? throw ValidationException::withMessages(['request' => 'La emisora de esta solicitud ya no existe.']);

        $previous = Frequency::query()->findOrFail($station->frequency_id);
        $station = $this->move->handle($station, $frequency);

        $this->audit->record('station.frequency_changed', $station, ['from' => $previous->label, 'to' => $frequency->label]);

        return $station;
    }
}
