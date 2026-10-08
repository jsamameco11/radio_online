<?php

namespace App\Domain\Marketplace\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Marketplace\Enums\ListingStatus;
use App\Domain\Marketplace\Enums\SalePayoutStatus;
use App\Domain\Marketplace\Notifications\StationPurchased;
use App\Domain\Marketplace\Notifications\StationSold;
use App\Domain\Marketplace\Notifications\StationTeamReleased;
use App\Domain\Marketplace\Support\SaleSplit;
use App\Domain\Monetization\Enums\WithdrawalStatus;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Stations\Support\StationLinks;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Exceptions\WalletFrozen;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\FrequencyListing;
use App\Models\FrequencyRequest;
use App\Models\Station;
use App\Models\StationMember;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * A listener buys a station on sale, paying from their wallet. Everything
 * happens in one database transaction: the price leaves the buyer's wallet
 * and stays with the platform, whatever the station wallet held is settled
 * to the seller, the previous team loses access and the buyer becomes the
 * only owner. The platform then owes the seller the price minus the
 * commission plus that settled balance, paid like a withdrawal.
 */
final class BuyStation
{
    public function __construct(
        private readonly WalletLedger $ledger,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(FrequencyListing $listing, User $buyer): FrequencyListing
    {
        $buyerWallet = $this->ledger->open($buyer);

        [$listing, $formerTeam] = DB::transaction(function () use ($listing, $buyer, $buyerWallet) {
            $listing = FrequencyListing::query()->lockForUpdate()->findOrFail($listing->id);

            if (! $listing->isActive()) {
                throw ValidationException::withMessages(['listing' => 'Esta radio ya no está en venta.']);
            }

            $station = Station::query()->lockForUpdate()->with('frequency')->findOrFail($listing->station_id);

            if ($station->owner_id === $buyer->id || $listing->seller_id === $buyer->id) {
                throw ValidationException::withMessages(['listing' => 'Esta radio ya es tuya.']);
            }

            if ($station->status !== StationStatus::Active || $station->owner_id !== $listing->seller_id || $this->isWithdrawing($station)) {
                throw ValidationException::withMessages(['listing' => 'Esta radio no está disponible para la compra en este momento.']);
            }

            $split = SaleSplit::of($listing->price_cents);

            $purchase = $this->ledger->debit($buyerWallet, WalletTransactionType::StationPurchase, $split->priceCents, new LedgerEntry(
                "station-sale:{$listing->id}:purchase",
                'Compra de '.$station->displayName(),
                $listing,
                $buyer,
                ['station_id' => $station->id],
            ));

            $settled = $this->settleStationWallet($station, $listing, $buyer);

            $formerTeam = StationMember::query()->where('station_id', $station->id)->get();
            $formerTeam->each->delete();
            StationMember::query()->create(['station_id' => $station->id, 'user_id' => $buyer->id, 'role' => StationRole::Owner]);
            $station->forceFill(['owner_id' => $buyer->id])->save();

            FrequencyRequest::query()
                ->where('station_id', $station->id)
                ->where('kind', FrequencyRequestKind::FrequencyChange->value)
                ->where('status', FrequencyRequestStatus::Pending->value)
                ->update(['status' => FrequencyRequestStatus::Cancelled->value, 'review_note' => 'Cancelada por la venta de la radio.', 'updated_at' => now()]);

            $listing->forceFill([
                'status' => ListingStatus::Sold,
                'frequency_id' => $station->frequency_id,
                'buyer_id' => $buyer->id,
                'sold_at' => now(),
                'processor_fee_cents' => $split->processorFeeCents,
                'fee_cents' => $split->feeCents,
                'tax_cents' => $split->taxCents,
                'settled_balance_cents' => $settled,
                'payout_cents' => $split->sellerCents + $settled,
                'payout_status' => SalePayoutStatus::Pending,
                'purchase_transaction_id' => $purchase->id,
            ])->save();

            return [$listing->setRelation('station', $station), $formerTeam];
        });

        $this->audit->record('station_sale.completed', $listing, [
            'price_cents' => $listing->price_cents,
            'processor_fee_cents' => $listing->processor_fee_cents,
            'fee_cents' => $listing->fee_cents,
            'tax_cents' => $listing->tax_cents,
            'settled_balance_cents' => $listing->settled_balance_cents,
            'payout_cents' => $listing->payout_cents,
            'seller_id' => $listing->seller_id,
            'buyer_id' => $buyer->id,
            'wallet_transaction_id' => $listing->purchase_transaction_id,
        ], $buyer, $listing->station);

        $this->notify($listing->load('seller'), $buyer, $formerTeam->pluck('user_id')->all());

        return $listing;
    }

    private function isWithdrawing(Station $station): bool
    {
        return WithdrawalRequest::acrossStations()
            ->where('station_id', $station->id)
            ->where('status', WithdrawalStatus::Pending->value)
            ->exists();
    }

    /** Empties the station wallet into the sale; returns the amount settled to the seller. */
    private function settleStationWallet(Station $station, FrequencyListing $listing, User $buyer): int
    {
        $wallet = $this->ledger->open($station);
        $balance = (int) Wallet::query()->lockForUpdate()->whereKey($wallet->id)->value('balance_cents');

        if ($balance <= 0) {
            return 0;
        }

        try {
            $this->ledger->debit($wallet, WalletTransactionType::SaleSettlement, $balance, new LedgerEntry(
                "station-sale:{$listing->id}:settlement",
                'Saldo liquidado al vendedor por la venta de la radio',
                $listing,
                $buyer,
            ));
        } catch (WalletFrozen) {
            throw ValidationException::withMessages(['listing' => 'Esta radio no está disponible para la compra en este momento.']);
        }

        return $balance;
    }

    /**
     * @param  list<int>  $formerTeam
     */
    private function notify(FrequencyListing $listing, User $buyer, array $formerTeam): void
    {
        $station = $listing->station;
        $name = $station->displayName();
        $currency = $listing->currency;

        $listing->seller->notify(new StationSold(
            $listing->id,
            $name,
            $listing->formattedPrice(),
            FrequencyListing::money($listing->processor_fee_cents + $listing->fee_cents + $listing->tax_cents, $currency),
            FrequencyListing::money($listing->settled_balance_cents, $currency),
            FrequencyListing::money($listing->payout_cents, $currency),
            (string) $listing->maskedDestination(),
        ));

        $buyer->notify(new StationPurchased($listing->id, $name, $listing->formattedPrice(), StationLinks::studio($station)));

        $released = User::query()->whereKey(array_diff($formerTeam, [$listing->seller_id, $buyer->id]))->get();
        Notification::send($released, new StationTeamReleased($name));
    }
}
