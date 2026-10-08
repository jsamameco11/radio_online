<?php

namespace App\Domain\Marketplace\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Wallet\WalletLedger;
use App\Models\Frequency;
use App\Models\FrequencyListing;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The platform staff puts a free frequency of the dial on sale at a fixed
 * price. The frequency is reserved so nobody can request it meanwhile; its
 * buyer opens a new station on it.
 */
final class ListFrequencyForSale
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Frequency $frequency, User $actor, int $priceCents, ?string $pitch): FrequencyListing
    {
        $minimum = (int) config('platform.marketplace.min_price_cents');
        $maximum = (int) config('platform.marketplace.max_price_cents');
        if ($priceCents < $minimum || $priceCents > $maximum) {
            $currency = WalletLedger::currency();

            throw ValidationException::withMessages(['price_cents' => 'El precio debe estar entre '.FrequencyListing::money($minimum, $currency).' y '.FrequencyListing::money($maximum, $currency).'.']);
        }

        $listing = DB::transaction(function () use ($frequency, $actor, $priceCents, $pitch) {
            $frequency = Frequency::query()->lockForUpdate()->findOrFail($frequency->id);

            if (! in_array($frequency->status, [FrequencyStatus::Available, FrequencyStatus::Reserved], true) || $frequency->station()->exists()) {
                throw ValidationException::withMessages(['frequency' => "La frecuencia {$frequency->display()} no está libre."]);
            }

            if ($frequency->isPriced() || FrequencyListing::query()->active()->where('frequency_id', $frequency->id)->exists()) {
                throw ValidationException::withMessages(['frequency' => "La frecuencia {$frequency->display()} ya está en venta."]);
            }

            if ($frequency->status === FrequencyStatus::Available) {
                $frequency->forceFill(['status' => FrequencyStatus::Reserved, 'reserved_at' => now()])->save();
            }

            return FrequencyListing::query()->create([
                'by_platform' => true,
                'frequency_id' => $frequency->id,
                'seller_id' => $actor->id,
                'price_cents' => $priceCents,
                'currency' => WalletLedger::currency(),
                'pitch' => $pitch,
            ]);
        });

        $this->audit->record('frequency_sale.listed', $listing, ['price_cents' => $priceCents, 'frequency_id' => $listing->frequency_id], $actor);

        return $listing;
    }
}
