<?php

namespace App\Http\Controllers\Public;

use App\Domain\Access\Support\SessionHandoff;
use App\Domain\Frequencies\Actions\PayFrequencyRequest;
use App\Domain\Frequencies\Actions\SaveFrequencyCard;
use App\Domain\Frequencies\Enums\FrequencyPaymentStatus;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Payments\PaymentGateways;
use App\Domain\Platform\PlatformHost;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\FrequencyCardRequest;
use App\Http\Resources\FrequencyPaymentResource;
use App\Http\Resources\Site\FrequencyRequestResource;
use App\Models\FrequencyRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The payment of a priced frequency, as its applicant sees it: register the
 * card charged on approval, or pay with another one after a decline.
 */
class FrequencyPaymentController extends Controller
{
    public function show(Request $request, FrequencyRequest $frequencyRequest, PaymentGateways $gateways): Response
    {
        abort_unless($frequencyRequest->user_id === $request->user()->id, 404);
        $frequencyRequest->load(['frequency', 'payment', 'station.frequency']);
        $payment = $frequencyRequest->payment ?? abort(404);

        $mode = match (true) {
            $frequencyRequest->status === FrequencyRequestStatus::Pending
                && in_array($payment->status, [FrequencyPaymentStatus::CardRequired, FrequencyPaymentStatus::CardSaved], true) => 'card',
            $frequencyRequest->status === FrequencyRequestStatus::AwaitingPayment && $payment->status === FrequencyPaymentStatus::Failed => 'pay',
            default => null,
        };
        $gateway = $gateways->cards($payment->provider);

        return Inertia::render('Public/FrequencyPayment', [
            'request' => FrequencyRequestResource::make($frequencyRequest)->resolve($request),
            'mode' => $mode,
            'sandbox' => $gateway->isSandbox(),
            'checkout' => $mode === null ? null : [
                ...$gateway->cardCheckout(),
                'driver' => $gateway->name(),
                'email' => $request->user()->email,
                'amount_cents' => $payment->amount_cents,
                'currency' => $payment->currency,
                'action_url' => route($mode === 'card' ? 'site.station-requests.card' : 'site.station-requests.pay', $frequencyRequest, absolute: false),
            ],
            'studioUrl' => $frequencyRequest->station?->frequency
                ? SessionHandoff::link(PlatformHost::Studio, '/'.$frequencyRequest->station->frequency->slug)
                : null,
        ]);
    }

    /** POST …/tarjeta: keeps the card on file; nothing is charged until the staff approves. */
    public function card(FrequencyCardRequest $request, FrequencyRequest $frequencyRequest, SaveFrequencyCard $save): JsonResponse
    {
        $attempt = $request->attempt();
        $payment = $save->handle($frequencyRequest, $attempt->token, $attempt->authentication3ds);

        return response()->json(['payment' => FrequencyPaymentResource::make($payment)->resolve($request)]);
    }

    /** POST …/pago: after a decline, charges a new card and opens the station. */
    public function pay(FrequencyCardRequest $request, FrequencyRequest $frequencyRequest, PayFrequencyRequest $pay): JsonResponse
    {
        $station = $pay->handle($frequencyRequest, $request->user(), $request->attempt());

        return response()->json(['station' => $station->displayName()]);
    }
}
