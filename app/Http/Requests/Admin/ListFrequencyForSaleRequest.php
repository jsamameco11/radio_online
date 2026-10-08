<?php

namespace App\Http\Requests\Admin;

use App\Models\Frequency;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

/** Admin > Ventas de radios > Vender una frecuencia: a free frequency of the dial ("89.30"), its price in cents and a pitch for buyers. */
class ListFrequencyForSaleRequest extends FormRequest
{
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
            'frequency' => ['required', 'string', 'max:10', function (string $attribute, mixed $value, Closure $fail) {
                if ($this->frequency() === null) {
                    $fail('Esa frecuencia no existe en el dial.');
                }
            }],
            'price_cents' => ['required', 'integer', 'min:'.(int) config('platform.marketplace.min_price_cents'), 'max:'.(int) config('platform.marketplace.max_price_cents')],
            'pitch' => ['nullable', 'string', 'max:600'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $minimum = number_format((int) config('platform.marketplace.min_price_cents') / 100, 2);
        $maximum = number_format((int) config('platform.marketplace.max_price_cents') / 100, 2);

        return [
            'frequency.*' => 'Escribe una frecuencia del dial, por ejemplo 89.30.',
            'price_cents.min' => "El precio mínimo es de US$ {$minimum}.",
            'price_cents.max' => "El precio máximo es de US$ {$maximum}.",
            'price_cents.*' => 'Escribe un precio válido.',
            'pitch.*' => 'La descripción para compradores puede tener como máximo 600 caracteres.',
        ];
    }

    public function frequency(): ?Frequency
    {
        $label = str_replace([',', '-'], '.', trim((string) $this->input('frequency')));

        return is_numeric($label) ? Frequency::query()->where('label', number_format((float) $label, 2, '.', ''))->first() : null;
    }

    public function pitch(): ?string
    {
        return $this->filled('pitch') ? trim((string) $this->validated('pitch')) : null;
    }
}
