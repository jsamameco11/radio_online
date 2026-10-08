<?php

namespace App\Http\Requests\Marketplace;

use App\Http\Requests\Concerns\ValidatesStationDetails;
use App\Models\FrequencyListing;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Frecuencias en venta > Comprar: the buyer confirms they understand the
 * purchase is final and, for a frequency the platform sells, names the
 * station that will broadcast on it.
 */
class BuyStationRequest extends FormRequest
{
    use ValidatesStationDetails;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = ['accepted' => ['accepted']];

        if ($this->forPlatformListing()) {
            $rules['station_name'] = $this->stationDetailsRules(null)['name'];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'accepted.*' => 'Confirma que entiendes que la compra es definitiva.',
            'station_name.required' => 'Escribe el nombre de tu radio.',
            'station_name.min' => 'El nombre debe tener al menos 3 caracteres.',
            'station_name.max' => 'El nombre puede tener como máximo 80 caracteres.',
            'station_name.string' => 'Escribe un nombre válido.',
        ];
    }

    public function stationName(): string
    {
        return trim((string) $this->validated('station_name'));
    }

    private function forPlatformListing(): bool
    {
        return FrequencyListing::query()->whereKey((int) $this->route('listing'))->where('by_platform', true)->exists();
    }
}
