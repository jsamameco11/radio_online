<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\ValidatesFrequencyPrice;
use Illuminate\Foundation\Http\FormRequest;

/** Admin > Frecuencias > Reservar, optionally with a price. Permission checked by the route. */
class ReserveFrequencyRequest extends FormRequest
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
        return [
            'note' => ['nullable', 'string', 'max:300'],
            'price_cents' => $this->priceRules(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'note.*' => 'La nota puede tener como máximo 300 caracteres.',
            ...$this->priceMessages(),
        ];
    }
}
