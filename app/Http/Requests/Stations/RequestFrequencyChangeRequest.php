<?php

namespace App\Http\Requests\Stations;

use App\Domain\Frequencies\FrequencyDial;
use App\Models\Frequency;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

/** Estudio > Configuración > Frecuencia: ask to move to another free frequency. */
class RequestFrequencyChangeRequest extends FormRequest
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
                if ($this->target() === null) {
                    $fail('Esa frecuencia no existe en el dial.');
                }
            }],
            'reason' => ['required', 'string', 'min:20', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'frequency.required' => 'Elige la frecuencia a la que quieres mudarte.',
            'frequency.string' => 'Escribe una frecuencia como 95.50.',
            'frequency.max' => 'Escribe una frecuencia como 95.50.',
            'reason.required' => 'Cuéntanos por qué quieres cambiar de frecuencia.',
            'reason.min' => 'Cuéntanos un poco más: al menos 20 caracteres.',
            'reason.max' => 'El motivo puede tener como máximo 1000 caracteres.',
        ];
    }

    public function target(): ?Frequency
    {
        $label = FrequencyDial::normalize((string) $this->input('frequency'));

        return $label === null ? null : Frequency::query()->where('label', $label)->first();
    }
}
