<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Admin > Frecuencias > Reservar. Permission checked by the route. */
class ReserveFrequencyRequest extends FormRequest
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
        return ['note' => ['nullable', 'string', 'max:300']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['note.*' => 'La nota puede tener como máximo 300 caracteres.'];
    }
}
