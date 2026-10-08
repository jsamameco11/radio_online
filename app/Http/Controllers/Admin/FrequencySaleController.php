<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Marketplace\Actions\ListFrequencyForSale;
use App\Domain\Marketplace\Actions\MarkSalePaid;
use App\Domain\Marketplace\Actions\WithdrawListing;
use App\Domain\Marketplace\Enums\ListingStatus;
use App\Domain\Marketplace\Enums\SalePayoutStatus;
use App\Domain\Marketplace\Support\SaleSplit;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListFrequencyForSaleRequest;
use App\Http\Requests\Admin\MarkWithdrawalPaidRequest;
use App\Http\Requests\Admin\ReviewNoteRequest;
use App\Http\Resources\Admin\FrequencySaleRowResource;
use App\Models\Frequency;
use App\Models\FrequencyListing;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin > Ventas de radios: stations their owners sell, free frequencies the
 * platform sells, sales whose seller is waiting for the payout, and the
 * history. The buyer's money is already held by the platform; for a station
 * sale the staff sends the seller their part and records the reference.
 */
class FrequencySaleController extends Controller
{
    private const TABS = ['to_pay', 'active', 'platform', 'paid', 'cancelled'];

    public function index(Request $request): Response
    {
        $tab = in_array($request->query('tab'), self::TABS, true) ? (string) $request->query('tab') : 'to_pay';

        $sold = FrequencyListing::query()->toBase()
            ->where('status', ListingStatus::Sold->value)
            ->selectRaw('by_platform, payout_status, count(*) as total, coalesce(sum(payout_cents), 0) as payout, coalesce(sum(fee_cents), 0) as fees')
            ->groupBy('by_platform', 'payout_status')
            ->get();
        $byStatus = FrequencyListing::query()->toBase()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $pending = $sold->first(fn (object $row) => ! $row->by_platform && $row->payout_status === SalePayoutStatus::Pending->value);
        $paid = $sold->first(fn (object $row) => ! $row->by_platform && $row->payout_status === SalePayoutStatus::Paid->value);
        $platform = $sold->filter(fn (object $row) => (bool) $row->by_platform);

        return Inertia::render('Admin/Sales/Index', [
            'tab' => $tab,
            'totals' => [
                'to_pay' => ['count' => (int) ($pending->total ?? 0), 'amount_cents' => (int) ($pending->payout ?? 0)],
                'active' => ['count' => (int) ($byStatus[ListingStatus::Active->value] ?? 0)],
                'platform' => ['count' => (int) $platform->sum('total'), 'amount_cents' => (int) $platform->sum('fees')],
                'paid' => ['count' => (int) ($paid->total ?? 0), 'amount_cents' => (int) ($paid->payout ?? 0)],
                'cancelled' => ['count' => (int) ($byStatus[ListingStatus::Cancelled->value] ?? 0)],
                'fees_cents' => (int) $sold->sum('fees'),
            ],
            'processorFeePercent' => SaleSplit::processorFeePercent(),
            'feePercent' => SaleSplit::feePercent(),
            'taxPercent' => SaleSplit::taxPercent(),
            'minPriceCents' => (int) config('platform.marketplace.min_price_cents'),
            'maxPriceCents' => (int) config('platform.marketplace.max_price_cents'),
            'sales' => $this->tab(FrequencyListing::query(), $tab)
                ->with(['frequency', 'station' => fn ($station) => $station->withTrashed()->with('frequency'), 'seller', 'buyer', 'payer'])
                ->paginate(20)
                ->withQueryString()
                ->through(fn (FrequencyListing $listing) => FrequencySaleRowResource::make($listing)->resolve($request)),
            'canWithdraw' => $request->user()->can('stations.update'),
            'canListFrequencies' => $request->user()->can('frequencies.assign'),
        ]);
    }

    public function store(ListFrequencyForSaleRequest $request, ListFrequencyForSale $list): RedirectResponse
    {
        /** @var Frequency $frequency */
        $frequency = $request->frequency();
        $listing = $list->handle($frequency, $request->user(), (int) $request->validated('price_cents'), $request->pitch());

        return redirect()->route('admin.sales.index', ['tab' => 'active'])
            ->with('success', "La frecuencia {$frequency->display()} ya está en venta por {$listing->formattedPrice()}.");
    }

    public function pay(MarkWithdrawalPaidRequest $request, FrequencyListing $listing, MarkSalePaid $pay): RedirectResponse
    {
        $paid = $pay->handle($listing, $request->user(), trim((string) $request->validated('reference')), $request->validated('note') ?: null);

        return back()->with('success', 'Pago de '.FrequencyListing::money($paid->payout_cents, $paid->currency).' registrado.');
    }

    public function withdraw(ReviewNoteRequest $request, FrequencyListing $listing, WithdrawListing $withdraw): RedirectResponse
    {
        $withdraw->handle($listing, $request->user(), (string) $request->validated('note'));

        return back()->with('success', $listing->by_platform
            ? 'Retiramos la frecuencia de la venta. Sigue reservada en el dial.'
            : 'Retiramos la radio de la venta y avisamos a su propietario.');
    }

    /**
     * @param  Builder<FrequencyListing>  $query
     * @return Builder<FrequencyListing>
     */
    private function tab(Builder $query, string $tab): Builder
    {
        return match ($tab) {
            'to_pay' => $query->where('status', ListingStatus::Sold->value)->where('payout_status', SalePayoutStatus::Pending->value)->orderBy('sold_at'),
            'platform' => $query->where('status', ListingStatus::Sold->value)->where('by_platform', true)->latest('sold_at'),
            'paid' => $query->where('status', ListingStatus::Sold->value)->where('payout_status', SalePayoutStatus::Paid->value)->latest('paid_at'),
            'cancelled' => $query->where('status', ListingStatus::Cancelled->value)->latest('cancelled_at'),
            default => $query->where('status', ListingStatus::Active->value)->latest(),
        };
    }
}
