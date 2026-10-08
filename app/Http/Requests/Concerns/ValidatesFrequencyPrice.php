<?php

namespace App\Http\Requests\Concerns;

/** The price of a priced frequency, in cents; empty means no price. */
trait ValidatesFrequencyPrice
{
    /**
     * @return list<string>
     */
    protected function priceRules(): array
    {
        return ['nullable', 'integer', 'min:'.(int) config('platform.marketplace.min_price_cents'), 'max:'.(int) config('platform.marketplace.max_price_cents')];
    }

    /**
     * @return array<string, string>
     */
    protected function priceMessages(): array
    {
        $minimum = number_format((int) config('platform.marketplace.min_price_cents') / 100, 2);
        $maximum = number_format((int) config('platform.marketplace.max_price_cents') / 100, 2);

        return [
            'price_cents.min' => "El precio mínimo es de US$ {$minimum}.",
            'price_cents.max' => "El precio máximo es de US$ {$maximum}.",
            'price_cents.*' => 'Escribe un precio válido.',
        ];
    }

    public function priceCents(): ?int
    {
        $price = $this->validated('price_cents');

        return $price === null ? null : (int) $price;
    }
}
