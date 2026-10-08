<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Admin > Solicitudes > settle an unconfirmed charge. Permission checked by the route. */
class SettleFrequencyPaymentRequest extends FormRequest
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
            'charged' => ['required', 'boolean'],
            'reference' => [Rule::requiredIf(fn () => $this->boolean('charged')), 'nullable', 'string', 'max:120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reference.required' => 'Escribe el código del cargo en la pasarela (chr_…).',
            'reference.*' => 'El código del cargo puede tener como máximo 120 caracteres.',
        ];
    }
}
