<?php

namespace App\Http\Controllers\Studio\Settings;

use App\Domain\Marketplace\Actions\ListStationForSale;
use App\Domain\Marketplace\Actions\WithdrawListing;
use App\Domain\Marketplace\Support\SaleSplit;
use App\Domain\Monetization\Enums\PayoutMethod;
use App\Domain\Monetization\Enums\WithdrawalStatus;
use App\Domain\Platform\PlatformHost;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Wallet\WalletLedger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Marketplace\ListStationForSaleRequest;
use App\Models\FrequencyListing;
use App\Models\WithdrawalRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio > Vender radio: the owner publishes the whole station on sale, updates the listing or takes it down. */
class SaleController extends Controller
{
    public function __construct(private readonly CurrentStation $current) {}

    public function show(Request $request, WalletLedger $ledger): Response
    {
        $station = $this->current->get()->loadMissing('frequency');
        $listing = FrequencyListing::query()->active()->where('station_id', $station->id)->first();

        return Inertia::render('Studio/Settings/Sale', [
            'listing' => $listing === null ? null : [
                'id' => $listing->id,
                'price_cents' => $listing->price_cents,
                'pitch' => $listing->pitch,
                'payout_method' => $listing->payout_method->value,
                'holder' => $listing->payout_details['holder'] ?? '',
                'account' => $listing->payout_details['account'] ?? '',
                'bank' => $listing->payout_details['bank'] ?? '',
                'destination' => $listing->maskedDestination(),
                'listed_at' => $listing->created_at?->toIso8601String(),
                'public_url' => PlatformHost::Public->url('frecuencias-en-venta/'.$listing->id),
            ],
            'blocked' => match (true) {
                $station->owner_id !== $request->user()->id => 'Solo la persona propietaria puede vender la radio.',
                $station->status !== StationStatus::Active => 'Tu radio está suspendida: no puede ponerse en venta.',
                $listing === null && $this->isWithdrawing() => 'Tienes un retiro en proceso. Podrás publicar la venta cuando lo paguemos.',
                default => null,
            },
            'balanceCents' => $ledger->balance($station),
            'currency' => WalletLedger::currency(),
            'processorFeePercent' => SaleSplit::processorFeePercent(),
            'feePercent' => SaleSplit::feePercent(),
            'taxPercent' => SaleSplit::taxPercent(),
            'minPriceCents' => (int) config('platform.marketplace.min_price_cents'),
            'maxPriceCents' => (int) config('platform.marketplace.max_price_cents'),
            'methods' => PayoutMethod::options(),
        ]);
    }

    public function store(ListStationForSaleRequest $request, ListStationForSale $list): RedirectResponse
    {
        $updating = FrequencyListing::query()->active()->where('station_id', $this->current->id())->exists();

        $list->handle(
            $this->current->get(),
            $request->user(),
            (int) $request->validated('price_cents'),
            $request->pitch(),
            $request->payoutMethod(),
            $request->details(),
        );

        return back()->with('success', $updating
            ? 'Actualizamos la publicación de tu radio.'
            : 'Tu radio ya está en venta. Te avisaremos por correo apenas alguien la compre.');
    }

    public function destroy(Request $request, WithdrawListing $withdraw): RedirectResponse
    {
        $listing = FrequencyListing::query()->active()->where('station_id', $this->current->id())->firstOrFail();
        $withdraw->handle($listing, $request->user());

        return back()->with('success', 'Retiraste tu radio de la venta.');
    }

    private function isWithdrawing(): bool
    {
        return WithdrawalRequest::query()->where('status', WithdrawalStatus::Pending->value)->exists();
    }
}
