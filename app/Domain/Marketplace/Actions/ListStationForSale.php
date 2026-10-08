<?php

namespace App\Domain\Marketplace\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Monetization\Enums\PayoutMethod;
use App\Domain\Monetization\Enums\WithdrawalStatus;
use App\Domain\Stations\Enums\StationStatus;
use App\Domain\Wallet\WalletLedger;
use App\Models\FrequencyListing;
use App\Models\Station;
use App\Models\User;
use App\Models\WithdrawalRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The owner puts the whole station on sale at a fixed price, or updates the
 * listing already published. One listing per station; never while a
 * withdrawal is in process, so whatever the station wallet holds at the time
 * of the sale is settled to the seller in full.
 */
final class ListStationForSale
{
    public function __construct(private readonly AuditTrail $audit) {}

    /**
     * @param  array{holder: string, account: string, bank?: ?string}  $details
     */
    public function handle(Station $station, User $seller, int $priceCents, ?string $pitch, PayoutMethod $method, array $details): FrequencyListing
    {
        $minimum = (int) config('platform.marketplace.min_price_cents');
        $maximum = (int) config('platform.marketplace.max_price_cents');
        if ($priceCents < $minimum || $priceCents > $maximum) {
            $currency = WalletLedger::currency();

            throw ValidationException::withMessages(['price_cents' => 'El precio debe estar entre '.FrequencyListing::money($minimum, $currency).' y '.FrequencyListing::money($maximum, $currency).'.']);
        }

        [$listing, $updated] = DB::transaction(function () use ($station, $seller, $priceCents, $pitch, $method, $details) {
            $station = Station::query()->lockForUpdate()->findOrFail($station->id);

            if ($station->owner_id !== $seller->id) {
                throw ValidationException::withMessages(['price_cents' => 'Solo la persona propietaria puede vender la radio.']);
            }

            if ($station->status !== StationStatus::Active) {
                throw ValidationException::withMessages(['price_cents' => 'Tu radio está suspendida: no puede ponerse en venta.']);
            }

            $withdrawing = WithdrawalRequest::acrossStations()
                ->where('station_id', $station->id)
                ->where('status', WithdrawalStatus::Pending->value)
                ->exists();
            if ($withdrawing) {
                throw ValidationException::withMessages(['price_cents' => 'Tienes un retiro en proceso. Podrás publicar la venta cuando lo paguemos.']);
            }

            $attributes = [
                'price_cents' => $priceCents,
                'pitch' => $pitch,
                'payout_method' => $method,
                'payout_details' => array_filter([
                    'holder' => $details['holder'],
                    'account' => $details['account'],
                    'bank' => $method->needsBank() ? ($details['bank'] ?? null) : null,
                ], fn (?string $value) => filled($value)),
            ];

            $listing = FrequencyListing::query()->active()->where('station_id', $station->id)->first();
            if ($listing !== null) {
                $listing->forceFill([...$attributes, 'seller_id' => $seller->id])->save();

                return [$listing, true];
            }

            return [FrequencyListing::query()->create([
                ...$attributes,
                'station_id' => $station->id,
                'frequency_id' => $station->frequency_id,
                'seller_id' => $seller->id,
                'currency' => WalletLedger::currency(),
            ]), false];
        });

        $this->audit->record($updated ? 'station_sale.updated' : 'station_sale.listed', $listing, [
            'price_cents' => $priceCents,
            'payout_method' => $method->value,
        ], $seller, $station);

        return $listing;
    }
}
