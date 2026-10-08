<?php

namespace App\Domain\Marketplace\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Marketplace\Enums\ListingStatus;
use App\Domain\Marketplace\Enums\SalePayoutStatus;
use App\Domain\Marketplace\Notifications\SalePayoutSent;
use App\Models\FrequencyListing;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** The platform sent the seller what a sale left them and records the transfer reference. */
final class MarkSalePaid
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(FrequencyListing $listing, User $actor, string $reference, ?string $note): FrequencyListing
    {
        $listing = DB::transaction(function () use ($listing, $actor, $reference, $note) {
            $listing = FrequencyListing::query()->lockForUpdate()->findOrFail($listing->id);

            if ($listing->status !== ListingStatus::Sold || $listing->payout_status !== SalePayoutStatus::Pending) {
                throw ValidationException::withMessages(['listing' => 'Este pago ya fue registrado.']);
            }

            $listing->forceFill([
                'payout_status' => SalePayoutStatus::Paid,
                'payout_reference' => $reference,
                'payout_note' => $note,
                'paid_by' => $actor->id,
                'paid_at' => now(),
            ])->save();

            return $listing;
        });

        $listing->load(['station.frequency', 'seller']);
        $this->audit->record('station_sale.paid', $listing, [
            'payout_cents' => $listing->payout_cents,
            'reference' => $reference,
        ], $actor, $listing->station);

        $listing->seller->notify(new SalePayoutSent(
            $listing->id,
            $listing->station->displayName(),
            FrequencyListing::money($listing->payout_cents, $listing->currency),
            $listing->maskedDestination(),
            $reference,
        ));

        return $listing;
    }
}
