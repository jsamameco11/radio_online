<?php

namespace App\Domain\Marketplace\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Marketplace\Enums\ListingStatus;
use App\Domain\Marketplace\Notifications\StationPurchased;
use App\Domain\Marketplace\Support\SaleSplit;
use App\Domain\Stations\Actions\OpenStation;
use App\Domain\Stations\Support\StationLinks;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\FrequencyListing;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * A listener buys a frequency the platform sells, paying from their wallet,
 * and a new station of theirs opens on it, with the name they chose. The
 * whole price stays with the platform (minus the card processor fee).
 */
final class BuyFrequency
{
    public function __construct(
        private readonly WalletLedger $ledger,
        private readonly OpenStation $open,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(FrequencyListing $listing, User $buyer, string $stationName): FrequencyListing
    {
        $buyerWallet = $this->ledger->open($buyer);

        $listing = DB::transaction(function () use ($listing, $buyer, $buyerWallet, $stationName) {
            $listing = FrequencyListing::query()->lockForUpdate()->with('frequency')->findOrFail($listing->id);

            if (! $listing->by_platform || ! $listing->isActive()) {
                throw ValidationException::withMessages(['listing' => 'Esta frecuencia ya no está en venta.']);
            }

            $split = SaleSplit::forPlatform($listing->price_cents);

            $purchase = $this->ledger->debit($buyerWallet, WalletTransactionType::StationPurchase, $split->priceCents, new LedgerEntry(
                "station-sale:{$listing->id}:purchase",
                'Compra de la frecuencia '.$listing->frequency->display(),
                $listing,
                $buyer,
                ['frequency_id' => $listing->frequency_id],
            ));

            $listing->forceFill([
                'status' => ListingStatus::Sold,
                'buyer_id' => $buyer->id,
                'sold_at' => now(),
                'processor_fee_cents' => $split->processorFeeCents,
                'fee_cents' => $split->feeCents,
                'tax_cents' => $split->taxCents,
                'settled_balance_cents' => 0,
                'payout_cents' => 0,
                'purchase_transaction_id' => $purchase->id,
            ])->save();

            try {
                $station = $this->open->handle($buyer, $listing->frequency, $stationName);
            } catch (InvalidArgumentException) {
                throw ValidationException::withMessages(['listing' => 'Esta frecuencia no está disponible para la compra en este momento.']);
            }

            $listing->forceFill(['station_id' => $station->id])->save();

            return $listing->setRelation('station', $station);
        });

        $station = $listing->station;
        $this->audit->record('frequency_sale.completed', $listing, [
            'price_cents' => $listing->price_cents,
            'processor_fee_cents' => $listing->processor_fee_cents,
            'buyer_id' => $buyer->id,
            'wallet_transaction_id' => $listing->purchase_transaction_id,
        ], $buyer, $station);

        $buyer->notify(new StationPurchased($listing->id, $station->displayName(), $listing->formattedPrice(), StationLinks::studio($station)));

        return $listing;
    }
}
