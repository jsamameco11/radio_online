<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\ValidatesFrequencyPrice;
use Illuminate\Foundation\Http\FormRequest;

/** Admin > Frecuencias > Precio of a reserved frequency; empty takes the price off. Permission checked by the route. */
class SetFrequencyPriceRequest extends FormRequest
{
    use ValidatesFrequencyPrice;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return ['price_cents' => $this->priceRules()];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return $this->priceMessages();
    }
}
