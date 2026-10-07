<?php

namespace App\Http\Requests\Admin;

use App\Domain\Frequencies\FrequencyDial;
use App\Models\Frequency;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Admin > Solicitudes > Aprobar. "frequency" is optional: another free
 * frequency ("95.50") when the requested one was taken meanwhile.
 */
class ApproveFrequencyRequestRequest extends FormRequest
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
            'frequency' => ['nullable', 'string', 'max:10', function (string $attribute, mixed $value, Closure $fail) {
                if ($this->alternative() === null) {
                    $fail('Esa frecuencia no existe en el dial.');
                }
            }],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'frequency.string' => 'Escribe una frecuencia como 95.50.',
            'frequency.max' => 'Escribe una frecuencia como 95.50.',
            'note.*' => 'La nota puede tener como máximo 500 caracteres.',
        ];
    }

    public function alternative(): ?Frequency
    {
        $label = FrequencyDial::normalize((string) $this->input('frequency'));

        return $label === null ? null : Frequency::query()->where('label', $label)->first();
    }
}
