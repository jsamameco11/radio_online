<?php

namespace App\Http\Requests\Marketplace;

use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use App\Http\Requests\Concerns\ValidatesPayoutDetails;
use Illuminate\Foundation\Http\FormRequest;

/** Estudio > Vender radio: the price in cents, a pitch for buyers and where to pay the seller. Owner only. */
class ListStationForSaleRequest extends FormRequest
{
    use ValidatesPayoutDetails;

    public function authorize(CurrentStation $current): bool
    {
        return $this->user()->canInStation($current->get(), StationPermission::SellStation);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'price_cents' => ['required', 'integer', 'min:'.self::minPrice(), 'max:'.(int) config('platform.marketplace.max_price_cents')],
            'pitch' => ['nullable', 'string', 'max:600'],
            'confirm' => ['accepted'],
            ...$this->payoutRules(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $minimum = number_format(self::minPrice() / 100, 2);
        $maximum = number_format((int) config('platform.marketplace.max_price_cents') / 100, 2);

        return [
            'price_cents.min' => "El precio mínimo es de US$ {$minimum}.",
            'price_cents.max' => "El precio máximo es de US$ {$maximum}.",
            'price_cents.*' => 'Escribe un precio válido.',
            'pitch.*' => 'La descripción para compradores puede tener como máximo 600 caracteres.',
            'confirm.*' => 'Confirma que entiendes cómo funciona la venta.',
            ...$this->payoutMessages(),
        ];
    }

    public function pitch(): ?string
    {
        return $this->filled('pitch') ? trim((string) $this->validated('pitch')) : null;
    }

    private static function minPrice(): int
    {
        return (int) config('platform.marketplace.min_price_cents');
    }
}
