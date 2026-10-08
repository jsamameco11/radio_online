<?php

namespace App\Http\Controllers\Public;

use App\Domain\Access\Support\SessionHandoff;
use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Marketplace\Actions\BuyFrequency;
use App\Domain\Marketplace\Actions\BuyStation;
use App\Domain\Marketplace\Enums\ListingStatus;
use App\Domain\Platform\PlatformHost;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Wallet\WalletLedger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Marketplace\BuyStationRequest;
use App\Http\Resources\FrequencyListingResource;
use App\Models\FrequencyListing;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Frecuencias en venta: whole stations their owners sell and free frequencies
 * the platform sells, at a fixed price. Anyone browses them; buying asks for
 * a verified account and is paid from the buyer's wallet.
 */
class MarketplaceController extends Controller
{
    private const SORTS = [
        'recientes' => ['created_at', 'desc'],
        'precio-menor' => ['price_cents', 'asc'],
        'precio-mayor' => ['price_cents', 'desc'],
    ];

    public function index(Request $request): Response
    {
        $sort = array_key_exists((string) $request->query('orden'), self::SORTS) ? (string) $request->query('orden') : 'recientes';
        $search = trim((string) $request->query('q'));
        [$column, $direction] = self::SORTS[$sort];

        $term = addcslashes($search, '%_\\');

        $listings = $this->listings()
            ->active()
            ->where(fn (Builder $offer) => $offer
                ->where(fn (Builder $platform) => $platform
                    ->where('by_platform', true)
                    ->whereHas('frequency', fn (Builder $frequency) => $frequency->where('status', FrequencyStatus::Reserved->value)))
                ->orWhere(fn (Builder $owned) => $owned
                    ->where('by_platform', false)
                    ->whereHas('station', fn (Builder $station) => $station->where('status', StationStatus::Active->value))))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $match) => $match
                ->whereHas('frequency', fn (Builder $frequency) => $frequency->where('label', 'like', $term.'%'))
                ->orWhereHas('station', fn (Builder $station) => $station->where('name', 'like', '%'.$term.'%'))))
            ->orderBy($column, $direction)
            ->orderByDesc('id')
            ->paginate(24)
            ->withQueryString()
            ->through(fn (FrequencyListing $listing) => FrequencyListingResource::make($listing)->resolve($request));

        return Inertia::render('Public/Marketplace/Index', [
            'listings' => $listings,
            'filters' => ['orden' => $sort, 'q' => $search],
            'sorts' => [
                ['value' => 'recientes', 'label' => 'Más recientes'],
                ['value' => 'precio-menor', 'label' => 'Precio: menor a mayor'],
                ['value' => 'precio-mayor', 'label' => 'Precio: mayor a menor'],
            ],
        ]);
    }

    public function show(Request $request, int $listing, WalletLedger $ledger): Response
    {
        $listing = $this->listings()->findOrFail($listing);
        $user = $request->user();

        abort_if($listing->status === ListingStatus::Cancelled || (! $listing->by_platform && $listing->station === null), 404);

        $bought = $user !== null && $listing->buyer_id === $user->id;
        $station = $listing->by_platform && $listing->isActive() ? null : $listing->station;

        return Inertia::render('Public/Marketplace/Show', [
            'listing' => FrequencyListingResource::make($listing)->resolve($request),
            'description' => $station?->description,
            'createdAt' => $station?->created_at->toIso8601String(),
            'viewer' => $user === null ? null : [
                'balance_cents' => $ledger->balance($user),
                'is_seller' => ! $listing->by_platform && ($listing->seller_id === $user->id || $station?->owner_id === $user->id),
                'bought' => $bought,
            ],
            'studioUrl' => $bought ? SessionHandoff::link(PlatformHost::Studio, '/'.$listing->frequency->slug) : null,
            'listenUrl' => $station === null ? null : '/radio/'.$listing->frequency->slug,
        ]);
    }

    public function buy(BuyStationRequest $request, int $listing, BuyStation $buyStation, BuyFrequency $buyFrequency): RedirectResponse
    {
        $listing = FrequencyListing::query()->findOrFail($listing);

        if ($listing->by_platform) {
            $buyFrequency->handle($listing, $request->user(), $request->stationName());

            return redirect()->route('site.marketplace.show', $listing->id)
                ->with('success', '¡Felicitaciones! La frecuencia ya es tuya y tu radio está creada. Entra a tu consola para ponerla a punto y salir al aire.');
        }

        $buyStation->handle($listing, $request->user());

        return redirect()->route('site.marketplace.show', $listing->id)
            ->with('success', '¡Felicitaciones! La radio ya es tuya. Entra a tu consola para armar tu equipo y salir al aire.');
    }

    /** @return Builder<FrequencyListing> */
    private function listings(): Builder
    {
        return FrequencyListing::query()->with([
            'frequency',
            'station' => fn ($station) => $station
                ->with(StationDirectory::RELATIONS)
                ->withCount(['episodes' => fn (Builder $episodes) => $episodes->published(), 'tracks']),
        ]);
    }
}
