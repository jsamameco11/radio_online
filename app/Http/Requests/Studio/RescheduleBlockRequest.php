<?php

namespace App\Http\Requests\Studio;

use Illuminate\Foundation\Http\FormRequest;

/** Moves a block of the main program from the console: some minutes later or to another time. */
class RescheduleBlockRequest extends FormRequest
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
            'minutes' => ['required_without:time', 'nullable', 'integer', 'between:1,720'],
            'time' => ['required_without:minutes', 'nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/'],
            'date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'minutes.*' => 'Corre el bloque entre 1 minuto y 12 horas.',
            'time.*' => 'Escribe la nueva hora (por ejemplo 18:30).',
            'date.*' => 'Elige un día válido.',
        ];
    }
}
