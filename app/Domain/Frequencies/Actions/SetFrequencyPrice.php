<?php

namespace App\Domain\Frequencies\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Wallet\WalletLedger;
use App\Models\Frequency;
use App\Models\FrequencyListing;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Puts a price on a reserved frequency (anyone may then request it and pays
 * when the staff approves) or takes it off (reserved again, nobody can ask
 * for it). Requests already sent keep the price they accepted.
 */
final class SetFrequencyPrice
{
    public function __construct(private readonly AuditTrail $audit) {}

    /** @throws ValidationException */
    public static function ensureInRange(int $priceCents): void
    {
        $minimum = (int) config('platform.marketplace.min_price_cents');
        $maximum = (int) config('platform.marketplace.max_price_cents');

        if ($priceCents < $minimum || $priceCents > $maximum) {
            $currency = WalletLedger::currency();

            throw ValidationException::withMessages(['price_cents' => 'El precio debe estar entre '.FrequencyListing::money($minimum, $currency).' y '.FrequencyListing::money($maximum, $currency).'.']);
        }
    }

    public function handle(Frequency $frequency, ?int $priceCents, User $actor): Frequency
    {
        if ($priceCents !== null) {
            self::ensureInRange($priceCents);
        }

        $previous = $frequency->price_cents;

        $frequency = DB::transaction(function () use ($frequency, $priceCents) {
            $frequency = Frequency::query()->lockForUpdate()->findOrFail($frequency->id);

            if ($frequency->status !== FrequencyStatus::Reserved || $frequency->station()->exists()) {
                throw ValidationException::withMessages(['price_cents' => "Solo una frecuencia reservada y libre puede tener precio; {$frequency->display()} no lo está."]);
            }

            if (FrequencyListing::query()->active()->where('frequency_id', $frequency->id)->exists()) {
                throw ValidationException::withMessages(['price_cents' => "{$frequency->display()} está publicada en el mercado. Retírala de la venta antes de ponerle precio."]);
            }

            $frequency->forceFill(['price_cents' => $priceCents])->save();

            return $frequency;
        });

        $this->audit->record($priceCents === null ? 'frequency.price_removed' : 'frequency.priced', $frequency, array_filter([
            'price_cents' => $priceCents,
            'previous_cents' => $previous,
        ], fn ($value) => $value !== null), $actor);

        return $frequency;
    }
}
