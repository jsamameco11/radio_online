<?php

namespace App\Domain\Marketplace\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Marketplace\Enums\ListingStatus;
use App\Domain\Marketplace\Notifications\ListingWithdrawn;
use App\Domain\Stations\Support\StationLinks;
use App\Models\FrequencyListing;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Takes a listing off the market. The seller does it from the studio; the
 * platform staff can do it from the panel, with a reason the seller receives.
 * A frequency the platform was selling stays reserved.
 */
final class WithdrawListing
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(FrequencyListing $listing, User $actor, ?string $reason = null): FrequencyListing
    {
        $listing = DB::transaction(function () use ($listing, $actor) {
            $listing = FrequencyListing::query()->lockForUpdate()->findOrFail($listing->id);

            if (! $listing->isActive()) {
                throw ValidationException::withMessages(['listing' => 'Ya no está en venta.']);
            }

            $listing->forceFill([
                'status' => ListingStatus::Cancelled,
                'cancelled_by' => $actor->id,
                'cancelled_at' => now(),
            ])->save();

            return $listing;
        });

        $listing->load(['station.frequency', 'seller']);
        $this->audit->record($listing->by_platform ? 'frequency_sale.withdrawn' : 'station_sale.withdrawn', $listing, array_filter(['reason' => $reason]), $actor, $listing->station);

        if (! $listing->by_platform && $actor->isNot($listing->seller)) {
            $listing->seller->notify(new ListingWithdrawn(
                $listing->id,
                $listing->station->displayName(),
                $reason,
                StationLinks::studio($listing->station).'/vender',
            ));
        }

        return $listing;
    }
}
